-- =====================================================================
--  CHECK THE VAR — Motor de partida para TODOS los modos
--  1) Preguntas: tipo (kind), pistas, origen del generador
--  2) Sesiones: total de preguntas, fin por tiempo, respuestas sospechosas
--  3) Estadísticas por modo
--  4) Funciones: game_start, game_next, game_clue, game_submit,
--     game_record_score, game_abandon, game_summary
--  Las REGLAS de cada modo (nº de preguntas, tiempo, fin al fallar, puntos)
--  viven en packages/shared/src/scoring.ts. Aquí solo se guarda, corrige y
--  se impide hacer trampas.
-- =====================================================================

create extension if not exists fuzzystrmatch;  -- levenshtein para texto libre

-- ---------------------------------------------------------------------
-- 1) PREGUNTAS
-- ---------------------------------------------------------------------
-- De qué "bolsa" sale cada pregunta: los modos tipo test usan 'quiz';
-- 'higher_lower', 'guess_player' y 'career_path' tienen su propio formato.
alter table public.questions
  add column kind          text not null default 'quiz'
    check (kind in ('quiz', 'higher_lower', 'guess_player', 'career_path')),
  add column generator_ref text,              -- clave natural dentro del generador (idempotencia)
  add column source_url    text;              -- fuente del dato (CLAUDE.md: nada inventado)

create unique index questions_generated_unique
  on public.questions (generator_key, generator_ref)
  where generator_key is not null and generator_ref is not null;
create index questions_pick_kind on public.questions (kind, status);

-- Pistas progresivas (adivina el jugador, trayectoria). Solo las lee el servidor.
create table public.question_clues (
  question_id bigint   not null references public.questions(id) on delete cascade,
  position    smallint not null check (position between 1 and 10),
  language    text     not null default 'es',
  clue        text     not null,
  primary key (question_id, position, language)
);
alter table public.question_clues enable row level security;

-- ---------------------------------------------------------------------
-- 2) SESIONES
-- ---------------------------------------------------------------------
alter table public.game_sessions
  add column question_total smallint,          -- null = sin límite (supervivencia, contrarreloj)
  add column question_kind  text not null default 'quiz',
  add column ends_at        timestamptz,       -- contrarreloj: fin de la partida
  add column fast_answers   smallint not null default 0;  -- respuestas en < 400 ms

alter table public.session_answers
  add column clues_used smallint not null default 1;

-- Cuenta marcada para revisión (respuestas imposiblemente rápidas, etc.).
alter table public.users
  add column flagged_at     timestamptz,
  add column flagged_reason text;

-- Mejor puntuación y partidas por modo (vitrina del perfil).
create table public.user_mode_stats (
  user_id        uuid not null references public.users(id) on delete cascade,
  game_mode_id   int  not null references public.game_modes(id),
  games_played   int  not null default 0,
  best_score     int  not null default 0,
  total_score    bigint not null default 0,
  best_streak    smallint not null default 0, -- mejor racha de aciertos en una partida
  last_played_at timestamptz,
  primary key (user_id, game_mode_id)
);
alter table public.user_mode_stats enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    create policy user_mode_stats_self_read on public.user_mode_stats
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) FUNCIONES
-- ---------------------------------------------------------------------
drop function if exists public.game_next(uuid, uuid, uuid, text);
drop function if exists public.game_submit(uuid, uuid, uuid, int, text, text);
drop function if exists public.game_record_score(uuid, uuid, uuid, int, boolean, int, int);
drop function if exists public.game_summary(uuid, uuid, uuid);

-- Total de preguntas de una sesión (null = sin límite).
create or replace function public._game_session_total(p_s public.game_sessions)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when p_s.challenge_id is not null then _game_total(p_s.challenge_id)
              else p_s.question_total end
$$;

-- Elige una pregunta publicada de la bolsa `p_kind` que no haya salido en esta
-- sesión. Para usuarios, evita las vistas en los últimos 7 días si hay otras.
create or replace function public._game_pick_question(
  p_session uuid, p_started timestamptz, p_user uuid, p_kind text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select q.id
  from questions q
  where q.status = 'published' and q.kind = p_kind
    and not exists (
      select 1 from session_answers sa
      where sa.session_id = p_session and sa.session_started = p_started and sa.question_id = q.id)
  order by
    (p_user is not null and exists (
      select 1 from game_sessions gs
      join session_answers sa on sa.session_id = gs.id and sa.session_started = gs.started_at
      where gs.user_id = p_user and gs.started_at > now() - interval '7 days'
        and sa.question_id = q.id)),
    random()
  limit 1
$$;

-- Empieza (o retoma) una partida de cualquier modo.
--   p_kind        bolsa de preguntas ('quiz', 'higher_lower', …)
--   p_total       nº de preguntas (null = sin límite)
--   p_duration_ms duración total (contrarreloj) o null
-- Si el jugador ya tiene una partida abierta de ese modo, se devuelve esa:
-- abandonar una pregunta difícil para "rerollear" no sirve de nada.
create or replace function public.game_start(
  p_user uuid, p_guest uuid, p_mode text, p_kind text, p_total int, p_duration_ms int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode game_modes;
  v_s game_sessions;
  v_plan plan_type;
begin
  if (p_user is null) = (p_guest is null) then
    raise exception 'player_required';
  end if;
  if p_mode = 'daily' then
    return game_start_daily(p_user, p_guest);
  end if;

  select * into v_mode from game_modes where slug = p_mode and is_active;
  if v_mode.id is null then
    raise exception 'mode_not_available';
  end if;
  if v_mode.requires_account and p_user is null then
    raise exception 'account_required';
  end if;
  if v_mode.requires_premium then
    select plan into v_plan from users where id = p_user;
    if v_plan is distinct from 'premium' then
      raise exception 'premium_required';
    end if;
  end if;

  -- Partida abierta reciente del mismo modo → se retoma.
  select * into v_s from game_sessions
  where game_mode_id = v_mode.id and status = 'started'
    and ((p_user is not null and user_id = p_user) or (p_guest is not null and guest_id = p_guest))
    and started_at > now() - interval '30 minutes'
    and (ends_at is null or ends_at > now())
  order by started_at desc limit 1;

  if v_s.id is not null then
    return jsonb_build_object(
      'sessionId', v_s.id, 'mode', p_mode, 'total', _game_session_total(v_s),
      'status', v_s.status, 'score', v_s.score, 'correctCount', v_s.correct_count,
      'answered', (select count(*) from session_answers
                   where session_id = v_s.id and session_started = v_s.started_at and answered_at is not null),
      'endsInMs', case when v_s.ends_at is null then null
                       else greatest(0, floor(extract(epoch from (v_s.ends_at - now())) * 1000))::int end,
      'resumed', true);
  end if;

  insert into game_sessions (user_id, guest_id, game_mode_id, status, question_total, question_kind, ends_at)
  values (p_user, p_guest, v_mode.id, 'started', p_total, coalesce(p_kind, 'quiz'),
          case when p_duration_ms is null then null else now() + make_interval(secs => p_duration_ms / 1000.0) end)
  returning * into v_s;

  return jsonb_build_object(
    'sessionId', v_s.id, 'mode', p_mode, 'total', p_total,
    'status', 'started', 'score', 0, 'correctCount', 0, 'answered', 0,
    'endsInMs', p_duration_ms, 'resumed', false);
end $$;

-- Pistas reveladas hasta ahora de una respuesta pendiente.
create or replace function public._game_clues(p_question bigint, p_count int, p_lang text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(c.clue order by c.position), '[]'::jsonb)
  from (
    select position, coalesce(
      (select clue from question_clues where question_id = p_question and position = qc.position and language = p_lang),
      qc.clue) as clue
    from question_clues qc
    where qc.question_id = p_question and qc.language = 'es' and qc.position <= p_count
  ) c
$$;

create or replace function public._game_clue_total(p_question bigint)
returns int
language sql
stable
security definer
set search_path = public
as $$ select count(*)::int from question_clues where question_id = p_question and language = 'es' $$;

-- Siguiente pregunta (sin la respuesta). Si hay una mostrada sin responder, la repite
-- con el MISMO shown_at: recargar la página no reinicia el reloj.
create or replace function public.game_next(p_session uuid, p_user uuid, p_guest uuid, p_lang text default 'es')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_total int;
  v_pending session_answers;
  v_answered int;
  v_question bigint;
  v_q questions;
  v_prompt text;
  v_category text;
  v_mode text;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  if v_s.status <> 'started' then
    return jsonb_build_object('done', true, 'status', v_s.status);
  end if;
  if v_s.ends_at is not null and v_s.ends_at <= now() then
    perform _game_finish(v_s.id, v_s.started_at, 'finished');
    return jsonb_build_object('done', true, 'status', 'finished');
  end if;
  v_total := _game_session_total(v_s);
  select slug into v_mode from game_modes where id = v_s.game_mode_id;

  select * into v_pending from session_answers
  where session_id = v_s.id and session_started = v_s.started_at and answered_at is null
  order by position limit 1;

  if v_pending.session_id is null then
    select count(*) into v_answered from session_answers
    where session_id = v_s.id and session_started = v_s.started_at;
    if v_total is not null and v_answered >= v_total then
      perform _game_finish(v_s.id, v_s.started_at, 'finished');
      return jsonb_build_object('done', true, 'status', 'finished');
    end if;

    if v_s.challenge_id is not null then
      select question_id into v_question from daily_challenge_questions
      where challenge_id = v_s.challenge_id and position = v_answered + 1;
    else
      v_question := _game_pick_question(v_s.id, v_s.started_at, p_user, v_s.question_kind);
    end if;
    if v_question is null then
      if v_answered > 0 then  -- se agotó la bolsa: la partida termina aquí
        perform _game_finish(v_s.id, v_s.started_at, 'finished');
        return jsonb_build_object('done', true, 'status', 'finished');
      end if;
      raise exception 'no_questions';
    end if;

    insert into session_answers (session_id, session_started, question_id, position, shown_at)
    values (v_s.id, v_s.started_at, v_question, v_answered + 1, now())
    returning * into v_pending;
  end if;

  select * into v_q from questions where id = v_pending.question_id;
  select coalesce(t.prompt, t_es.prompt), c.slug
  into v_prompt, v_category
  from questions q
  join question_categories c on c.id = q.category_id
  left join question_translations t    on t.question_id = q.id and t.language = p_lang
  left join question_translations t_es on t_es.question_id = q.id and t_es.language = 'es'
  where q.id = v_q.id;

  return jsonb_build_object(
    'done', false,
    'sessionId', v_s.id,
    'mode', v_mode,
    'position', v_pending.position,
    'total', v_total,
    'format', v_q.format,
    'prompt', v_prompt,
    'category', v_category,
    'elapsedMs', floor(extract(epoch from (now() - v_pending.shown_at)) * 1000)::int,
    'endsInMs', case when v_s.ends_at is null then null
                     else greatest(0, floor(extract(epoch from (v_s.ends_at - now())) * 1000))::int end,
    'sessionScore', v_s.score,
    'confirmedCount', v_s.correct_count,
    'options', case when v_q.format = 'free_text' then '[]'::jsonb else
      (select coalesce(jsonb_agg(jsonb_build_object('id', o.letter, 'label', o.label) order by o.letter), '[]'::jsonb)
       from _game_options(v_s.id, v_pending.question_id, p_lang) o) end,
    'clues', case when v_q.format = 'free_text' then _game_clues(v_q.id, v_pending.clues_used, p_lang) else null end,
    'cluesUsed', case when v_q.format = 'free_text' then v_pending.clues_used else null end,
    'cluesTotal', case when v_q.format = 'free_text' then _game_clue_total(v_q.id) else null end);
end $$;

-- Pide una pista más (adivina el jugador / trayectoria). Cuenta para los puntos.
create or replace function public.game_clue(p_session uuid, p_user uuid, p_guest uuid, p_position int, p_lang text default 'es')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_a session_answers;
  v_total int;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  if v_s.status <> 'started' then
    raise exception 'session_closed';
  end if;
  select * into v_a from session_answers
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
  for update;
  if v_a.session_id is null then
    raise exception 'question_not_shown';
  end if;
  if v_a.answered_at is not null then
    raise exception 'session_closed';
  end if;
  v_total := _game_clue_total(v_a.question_id);
  if v_total = 0 then
    raise exception 'invalid_choice';
  end if;
  if v_a.clues_used < v_total then
    update session_answers set clues_used = clues_used + 1
    where session_id = v_s.id and session_started = v_s.started_at and position = p_position
    returning * into v_a;
  end if;
  return jsonb_build_object(
    'position', p_position,
    'clues', _game_clues(v_a.question_id, v_a.clues_used, p_lang),
    'cluesUsed', v_a.clues_used, 'cluesTotal', v_total);
end $$;

-- ¿Coincide un texto normalizado con alguna respuesta aceptada?
-- Exacto, o con una errata (levenshtein ≤ 1) en respuestas de 6+ letras.
create or replace function public._game_text_matches(p_question bigint, p_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from question_accepted_answers a
    where a.question_id = p_question
      and (a.answer_norm = p_text
           or (char_length(a.answer_norm) >= 6 and char_length(p_text) >= 5
               and levenshtein(a.answer_norm, p_text) <= 1)))
$$;

-- CHECK THE VAR: registra la respuesta (una sola vez) y devuelve la corrección en bruto.
-- p_choice: letra (tipo test). p_text: texto ya normalizado por el servidor (texto libre).
-- Ambos null = se acabó el tiempo. Si ya se respondió, devuelve lo guardado (idempotente).
create or replace function public.game_submit(
  p_session uuid, p_user uuid, p_guest uuid, p_position int, p_choice text, p_text text, p_lang text default 'es')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_a session_answers;
  v_q questions;
  v_option bigint;
  v_correct_letter text;
  v_correct_label text;
  v_raw_correct boolean;
  v_last_miss int;
  v_explanation text;
  v_total int;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  v_total := _game_session_total(v_s);

  select * into v_a from session_answers
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
  for update;
  if v_a.session_id is null then
    raise exception 'question_not_shown';
  end if;
  select * into v_q from questions where id = v_a.question_id;

  select o.letter, o.label into v_correct_letter, v_correct_label
  from _game_options(v_s.id, v_a.question_id, p_lang) o where o.is_correct limit 1;

  select coalesce(t.explanation, t_es.explanation) into v_explanation
  from questions q
  left join question_translations t    on t.question_id = q.id and t.language = p_lang
  left join question_translations t_es on t_es.question_id = q.id and t_es.language = 'es'
  where q.id = v_a.question_id;

  -- Racha antes de esta respuesta: aciertos seguidos desde el último fallo.
  select max(position) into v_last_miss from session_answers
  where session_id = v_s.id and session_started = v_s.started_at
    and position < p_position and coalesce(is_correct, false) = false;

  if v_a.answered_at is not null then
    return jsonb_build_object(
      'alreadyAnswered', true, 'scored', v_a.scored_at is not null,
      'mode', (select slug from game_modes where id = v_s.game_mode_id),
      'position', p_position, 'total', v_total,
      'format', v_q.format, 'choice', v_a.choice, 'answerText', v_a.answer_text,
      'rawCorrect', case when v_q.format = 'free_text'
                         then v_a.answer_text is not null and _game_text_matches(v_q.id, v_a.answer_text)
                         else coalesce(v_a.choice = v_correct_letter, false) end,
      'isCorrect', v_a.is_correct, 'points', v_a.points,
      'elapsedMs', floor(extract(epoch from (v_a.answered_at - v_a.shown_at)) * 1000)::int,
      'cluesUsed', v_a.clues_used, 'cluesTotal', _game_clue_total(v_q.id),
      'streakBefore', p_position - 1 - coalesce(v_last_miss, 0),
      'correctOptionId', v_correct_letter, 'correctLabel', v_correct_label,
      'explanation', v_explanation, 'sessionScore', v_s.score, 'status', v_s.status);
  end if;

  if v_s.status <> 'started' then
    raise exception 'session_closed';
  end if;

  if v_q.format = 'free_text' then
    if p_choice is not null then
      raise exception 'invalid_choice';
    end if;
    v_raw_correct := p_text is not null and _game_text_matches(v_q.id, p_text);
  else
    if p_text is not null then
      raise exception 'invalid_choice';
    end if;
    if p_choice is not null then
      select o.option_id into v_option
      from _game_options(v_s.id, v_a.question_id, p_lang) o where o.letter = upper(p_choice);
      if v_option is null then
        raise exception 'invalid_choice';
      end if;
    end if;
    v_raw_correct := p_choice is not null and upper(p_choice) = v_correct_letter;
  end if;

  update session_answers
  set answered_at = now(), option_id = v_option, choice = upper(p_choice), answer_text = left(p_text, 80)
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
  returning * into v_a;

  return jsonb_build_object(
    'alreadyAnswered', false, 'scored', false,
    'mode', (select slug from game_modes where id = v_s.game_mode_id),
    'position', p_position, 'total', v_total,
    'format', v_q.format, 'choice', v_a.choice, 'answerText', v_a.answer_text,
    'rawCorrect', v_raw_correct,
    'elapsedMs', floor(extract(epoch from (v_a.answered_at - v_a.shown_at)) * 1000)::int,
    'cluesUsed', v_a.clues_used, 'cluesTotal', _game_clue_total(v_q.id),
    'streakBefore', p_position - 1 - coalesce(v_last_miss, 0),
    'correctOptionId', v_correct_letter, 'correctLabel', v_correct_label,
    'explanation', v_explanation, 'sessionScore', v_s.score, 'status', v_s.status);
end $$;

-- Cierra una partida y vuelca estadísticas (una sola vez). Sustituye a la versión anterior
-- para añadir las estadísticas por modo.
create or replace function public._game_finish(p_session uuid, p_started timestamptz, p_status session_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_best_streak int;
begin
  update game_sessions
  set status = p_status, finished_at = now()
  where id = p_session and started_at = p_started and status = 'started'
  returning * into v_s;
  if v_s.id is null then
    return;  -- ya estaba cerrada
  end if;

  if v_s.guest_id is not null then
    update guest_sessions set pending_points = pending_points + v_s.score where id = v_s.guest_id;
    return;
  end if;

  perform _game_credit_user(v_s.user_id, v_s.id, v_s.started_at, true);

  -- Mejor racha de aciertos seguidos dentro de la partida.
  select coalesce(max(run), 0) into v_best_streak from (
    select count(*) as run from (
      select position, is_correct,
             position - row_number() over (partition by is_correct order by position) as grp
      from session_answers
      where session_id = v_s.id and session_started = v_s.started_at and answered_at is not null
    ) x where is_correct group by grp
  ) runs;

  insert into user_mode_stats (user_id, game_mode_id, games_played, best_score, total_score, best_streak, last_played_at)
  values (v_s.user_id, v_s.game_mode_id, 1, v_s.score, v_s.score, v_best_streak, now())
  on conflict (user_id, game_mode_id) do update set
    games_played   = user_mode_stats.games_played + 1,
    best_score     = greatest(user_mode_stats.best_score, excluded.best_score),
    total_score    = user_mode_stats.total_score + excluded.total_score,
    best_streak    = greatest(user_mode_stats.best_streak, excluded.best_streak),
    last_played_at = now();
end $$;

-- Guarda los puntos calculados por scoring.ts. Idempotente: solo la primera vez cuenta.
-- p_finish = true cuando las reglas del modo dicen que la partida termina aquí
-- (p. ej. supervivencia al fallar).
create or replace function public.game_record_score(
  p_session uuid, p_user uuid, p_guest uuid, p_position int,
  p_counted boolean, p_points int, p_elapsed_ms int, p_finish boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_a session_answers;
  v_total int;
begin
  if p_points < 0 or p_points > 1000 then
    raise exception 'invalid_points';
  end if;
  v_s := _game_owned_session(p_session, p_user, p_guest);
  v_total := _game_session_total(v_s);

  update session_answers
  set is_correct = p_counted, points = p_points, scored_at = now()
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
    and answered_at is not null and scored_at is null
  returning * into v_a;

  if v_a.session_id is not null then
    update game_sessions
    set score = score + p_points,
        correct_count = correct_count + case when p_counted then 1 else 0 end,
        fast_answers = fast_answers + case when p_elapsed_ms < 400 and v_a.choice is not null then 1 else 0 end
    where id = v_s.id and started_at = v_s.started_at
    returning * into v_s;

    -- Antitrampas: 5 respuestas en menos de 400 ms en la misma partida → cuenta en revisión.
    if v_s.fast_answers >= 5 and v_s.user_id is not null then
      update users set flagged_at = coalesce(flagged_at, now()),
                       flagged_reason = coalesce(flagged_reason, 'respuestas_rapidas')
      where id = v_s.user_id;
    end if;

    insert into question_stats (question_id, times_shown, times_correct, avg_time_ms)
    values (v_a.question_id, 1, case when p_counted then 1 else 0 end, p_elapsed_ms)
    on conflict (question_id) do update set
      avg_time_ms   = ((coalesce(question_stats.avg_time_ms, 0)::bigint * question_stats.times_shown
                        + p_elapsed_ms) / (question_stats.times_shown + 1))::int,
      times_shown   = question_stats.times_shown + 1,
      times_correct = question_stats.times_correct + excluded.times_correct;

    if p_finish or (v_total is not null and p_position >= v_total)
       or (v_s.ends_at is not null and v_s.ends_at <= now()) then
      perform _game_finish(v_s.id, v_s.started_at, 'finished');
      select * into v_s from game_sessions where id = v_s.id and started_at = v_s.started_at;
    end if;
  end if;

  return jsonb_build_object(
    'sessionScore', v_s.score, 'correctCount', v_s.correct_count,
    'status', v_s.status, 'total', v_total);
end $$;

-- El jugador abandona: la partida cuenta como jugada con lo respondido hasta ahora.
create or replace function public.game_abandon(p_session uuid, p_user uuid, p_guest uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  if v_s.challenge_id is not null then
    raise exception 'session_closed';  -- el reto diario no se abandona: se retoma
  end if;
  perform _game_finish(v_s.id, v_s.started_at, 'abandoned');
  return game_summary(p_session, p_user, p_guest);
end $$;

-- Resumen final de una partida.
create or replace function public.game_summary(p_session uuid, p_user uuid, p_guest uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_mode text;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  select slug into v_mode from game_modes where id = v_s.game_mode_id;
  return jsonb_build_object(
    'sessionId', v_s.id, 'mode', v_mode, 'status', v_s.status,
    'score', v_s.score, 'correctCount', v_s.correct_count,
    'total', _game_session_total(v_s),
    'answered', (select count(*) from session_answers
                 where session_id = v_s.id and session_started = v_s.started_at and answered_at is not null),
    'pendingPoints', (select pending_points from guest_sessions where id = v_s.guest_id),
    'streak', (select current_streak from user_stats where user_id = v_s.user_id),
    'bestScore', (select best_score from user_mode_stats
                  where user_id = v_s.user_id and game_mode_id = v_s.game_mode_id),
    'isBest', v_s.user_id is not null and v_s.status <> 'started' and v_s.score > 0 and v_s.score >= coalesce(
                (select best_score from user_mode_stats
                 where user_id = v_s.user_id and game_mode_id = v_s.game_mode_id), 0));
end $$;

-- Solo el servidor puede ejecutar el motor de partida.
do $$
declare
  f text;
begin
  foreach f in array array[
    '_game_session_total(public.game_sessions)', '_game_pick_question(uuid,timestamptz,uuid,text)',
    'game_start(uuid,uuid,text,text,int,int)', '_game_clues(bigint,int,text)', '_game_clue_total(bigint)',
    'game_next(uuid,uuid,uuid,text)', 'game_clue(uuid,uuid,uuid,int,text)',
    '_game_text_matches(bigint,text)', 'game_submit(uuid,uuid,uuid,int,text,text,text)',
    '_game_finish(uuid,timestamptz,session_status)',
    'game_record_score(uuid,uuid,uuid,int,boolean,int,int,boolean)',
    'game_abandon(uuid,uuid,uuid)', 'game_summary(uuid,uuid,uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon, authenticated', f);
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;
