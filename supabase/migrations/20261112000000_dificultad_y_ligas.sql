-- =====================================================================
--  CHECK THE VAR — Niveles de dificultad y ligas por temporada
--  1) Dificultad: nivel del jugador y de cada partida (rangos en scoring.ts)
--  2) Motor: elegir preguntas por rango, partidas de jornada de liga
--  3) Ligas privadas: crear, unirse, jornadas temáticas semanales, 1 contra 1,
--     cierre de jornada, clasificación, campeón y temporada siguiente
--  Las reglas (rangos de dificultad, multiplicadores, puntos) viven en
--  packages/shared/src/scoring.ts; el servidor se los pasa a estas funciones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) DIFICULTAD
-- ---------------------------------------------------------------------
create or replace function public._valid_difficulty(p text)
returns boolean
language sql
immutable
as $$ select p in ('normal', 'aficionado', 'estrella', 'leyenda', 'historico') $$;

alter table public.users
  add column difficulty text not null default 'aficionado' check (public._valid_difficulty(difficulty));

alter table public.game_sessions
  add column difficulty     text check (difficulty is null or public._valid_difficulty(difficulty)),
  add column difficulty_min smallint,
  add column difficulty_max smallint,
  add column difficulty_old boolean not null default false;

-- El nivel elegido al registrarse llega en los metadatos de Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_n int := 0;
  v_difficulty text := new.raw_user_meta_data ->> 'difficulty';
begin
  v_base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(v_base) < 3 then
    v_base := 'jugador';
  end if;
  v_base := left(v_base, 18);
  v_candidate := v_base;
  while exists (select 1 from public.users where username = v_candidate) loop
    v_n := v_n + 1;
    v_candidate := v_base || v_n::text;
  end loop;

  insert into public.users (id, username, email, display_name, difficulty)
  values (new.id, v_candidate, new.email,
          coalesce(new.raw_user_meta_data ->> 'display_name', v_candidate),
          case when public._valid_difficulty(v_difficulty) then v_difficulty else 'aficionado' end);
  insert into public.user_stats (user_id) values (new.id);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2) LIGAS: columnas y tablas que faltaban
-- ---------------------------------------------------------------------
alter table public.leagues
  add column difficulty     text not null default 'aficionado' check (public._valid_difficulty(difficulty)),
  add column difficulty_min smallint not null default 1,
  add column difficulty_max smallint not null default 3,
  add column difficulty_old boolean not null default false,
  add column deleted_at     timestamptz,
  add constraint leagues_name_length check (char_length(name) between 3 and 40);
create index leagues_owner on public.leagues(owner_id) where deleted_at is null;

alter table public.league_seasons
  add column status text not null default 'active' check (status in ('active', 'finished'));
create index league_seasons_league on public.league_seasons(league_id, number desc);

alter table public.matchdays add column theme_label text;
create index matchdays_due on public.matchdays(status, closes_at);

alter table public.matchday_results
  add column played  boolean not null default false,
  add column outcome char(1) check (outcome in ('W', 'D', 'L', 'R'));  -- 1 contra 1: gana, empata, pierde, descansa
create index fixtures_matchday on public.fixtures(matchday_id);

-- Candado: una partida por jugador y jornada.
create table public.matchday_plays (
  matchday_id     bigint not null references public.matchdays(id) on delete cascade,
  user_id         uuid   not null references public.users(id) on delete cascade,
  session_id      uuid   not null,
  session_started timestamptz not null,
  created_at      timestamptz not null default now(),
  primary key (matchday_id, user_id)
);
alter table public.matchday_plays enable row level security;

alter table public.user_trophies add column league_id bigint references public.leagues(id) on delete set null;

insert into public.game_modes (slug, name_es, requires_account) values ('league', 'Jornada de liga', true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 3) MOTOR: elegir preguntas por rango de dificultad
-- ---------------------------------------------------------------------
drop function if exists public._game_pick_question(uuid, timestamptz, uuid, text);

-- Primero las del rango; si no quedan, las más cercanas. Nivel "histórico": las de antes
-- de 1990 tienen el doble de probabilidad. Para usuarios, evita las vistas en 7 días.
create or replace function public._game_pick_question(
  p_session uuid, p_started timestamptz, p_user uuid, p_kind text,
  p_min int, p_max int, p_old boolean)
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
    case when q.difficulty between coalesce(p_min, 1) and coalesce(p_max, 5) then 0
         else least(abs(q.difficulty - coalesce(p_min, 1)), abs(q.difficulty - coalesce(p_max, 5))) end,
    (p_user is not null and exists (
      select 1 from game_sessions gs
      join session_answers sa on sa.session_id = gs.id and sa.session_started = gs.started_at
      where gs.user_id = p_user and gs.started_at > now() - interval '7 days'
        and sa.question_id = q.id)),
    random() * case when p_old and coalesce(q.era_to, 9999) < 1990 then 0.5 else 1 end
  limit 1
$$;

create or replace function public._game_session_total(p_s public.game_sessions)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_s.challenge_id is not null then _game_total(p_s.challenge_id)
    when p_s.matchday_id  is not null then (select count(*)::int from matchday_questions where matchday_id = p_s.matchday_id)
    else p_s.question_total end
$$;

drop function if exists public.game_start(uuid, uuid, text, text, int, int);

create or replace function public.game_start(
  p_user uuid, p_guest uuid, p_mode text, p_kind text, p_total int, p_duration_ms int,
  p_level text, p_min int, p_max int, p_old boolean)
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
  if p_mode = 'league' then
    raise exception 'mode_not_available';  -- las jornadas se empiezan con game_start_league
  end if;
  if p_level is not null and not _valid_difficulty(p_level) then
    raise exception 'invalid_input';
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

  -- Partida abierta reciente del mismo modo → se retoma (con su nivel).
  select * into v_s from game_sessions
  where game_mode_id = v_mode.id and status = 'started'
    and ((p_user is not null and user_id = p_user) or (p_guest is not null and guest_id = p_guest))
    and started_at > now() - interval '30 minutes'
    and (ends_at is null or ends_at > now())
  order by started_at desc limit 1;

  if v_s.id is not null then
    return jsonb_build_object(
      'sessionId', v_s.id, 'mode', p_mode, 'total', _game_session_total(v_s),
      'difficulty', v_s.difficulty,
      'status', v_s.status, 'score', v_s.score, 'correctCount', v_s.correct_count,
      'answered', (select count(*) from session_answers
                   where session_id = v_s.id and session_started = v_s.started_at and answered_at is not null),
      'endsInMs', case when v_s.ends_at is null then null
                       else greatest(0, floor(extract(epoch from (v_s.ends_at - now())) * 1000))::int end,
      'resumed', true);
  end if;

  insert into game_sessions (user_id, guest_id, game_mode_id, status, question_total, question_kind, ends_at,
                             difficulty, difficulty_min, difficulty_max, difficulty_old)
  values (p_user, p_guest, v_mode.id, 'started', p_total, coalesce(p_kind, 'quiz'),
          case when p_duration_ms is null then null else now() + make_interval(secs => p_duration_ms / 1000.0) end,
          p_level, p_min, p_max, coalesce(p_old, false))
  returning * into v_s;

  return jsonb_build_object(
    'sessionId', v_s.id, 'mode', p_mode, 'total', p_total, 'difficulty', p_level,
    'status', 'started', 'score', 0, 'correctCount', 0, 'answered', 0,
    'endsInMs', p_duration_ms, 'resumed', false);
end $$;

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
  v_md matchdays;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  if v_s.status <> 'started' then
    return jsonb_build_object('done', true, 'status', v_s.status);
  end if;
  if v_s.ends_at is not null and v_s.ends_at <= now() then
    perform _game_finish(v_s.id, v_s.started_at, 'finished');
    return jsonb_build_object('done', true, 'status', 'finished');
  end if;
  if v_s.matchday_id is not null then
    select * into v_md from matchdays where id = v_s.matchday_id;
    if v_md.status = 'closed' or v_md.closes_at <= now() then
      perform _game_finish(v_s.id, v_s.started_at, 'finished');
      return jsonb_build_object('done', true, 'status', 'finished');
    end if;
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
    elsif v_s.matchday_id is not null then
      select question_id into v_question from matchday_questions
      where matchday_id = v_s.matchday_id and position = v_answered + 1;
    else
      v_question := _game_pick_question(v_s.id, v_s.started_at, p_user, v_s.question_kind,
                                        v_s.difficulty_min, v_s.difficulty_max, v_s.difficulty_old);
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
    'difficulty', v_s.difficulty,
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

-- La jornada de liga, como el reto diario, no se abandona: se retoma.
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
  if v_s.challenge_id is not null or v_s.matchday_id is not null then
    raise exception 'session_closed';
  end if;
  perform _game_finish(v_s.id, v_s.started_at, 'abandoned');
  return game_summary(p_session, p_user, p_guest);
end $$;

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
    'sessionId', v_s.id, 'mode', v_mode, 'status', v_s.status, 'difficulty', v_s.difficulty,
    'score', v_s.score, 'correctCount', v_s.correct_count,
    'total', _game_session_total(v_s),
    'answered', (select count(*) from session_answers
                 where session_id = v_s.id and session_started = v_s.started_at and answered_at is not null),
    'pendingPoints', (select pending_points from guest_sessions where id = v_s.guest_id),
    'streak', (select current_streak from user_stats where user_id = v_s.user_id),
    'leagueId', (select ls.league_id from matchdays md join league_seasons ls on ls.id = md.league_season_id
                 where md.id = v_s.matchday_id),
    'bestScore', (select best_score from user_mode_stats
                  where user_id = v_s.user_id and game_mode_id = v_s.game_mode_id),
    'isBest', v_s.user_id is not null and v_s.matchday_id is null and v_s.status <> 'started' and v_s.score > 0
              and v_s.score >= coalesce((select best_score from user_mode_stats
                                         where user_id = v_s.user_id and game_mode_id = v_s.game_mode_id), 0));
end $$;

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
      'mode', (select slug from game_modes where id = v_s.game_mode_id), 'difficulty', v_s.difficulty,
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
    'mode', (select slug from game_modes where id = v_s.game_mode_id), 'difficulty', v_s.difficulty,
    'position', p_position, 'total', v_total,
    'format', v_q.format, 'choice', v_a.choice, 'answerText', v_a.answer_text,
    'rawCorrect', v_raw_correct,
    'elapsedMs', floor(extract(epoch from (v_a.answered_at - v_a.shown_at)) * 1000)::int,
    'cluesUsed', v_a.clues_used, 'cluesTotal', _game_clue_total(v_q.id),
    'streakBefore', p_position - 1 - coalesce(v_last_miss, 0),
    'correctOptionId', v_correct_letter, 'correctLabel', v_correct_label,
    'explanation', v_explanation, 'sessionScore', v_s.score, 'status', v_s.status);
end $$;


-- ---------------------------------------------------------------------
-- 4) LIGAS
-- ---------------------------------------------------------------------

-- Código de invitación de 6 caracteres sin letras ambiguas (ni 0/O ni 1/I/L).
-- gen_random_uuid() es aleatorio criptográficamente: el código no se puede adivinar en serie.
create or replace function public._league_new_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_hex text;
  v_code text;
  i int;
begin
  loop
    v_hex := replace(gen_random_uuid()::text, '-', '');
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + (('x' || substr(v_hex, i * 4 + 1, 4))::bit(16)::int % length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from leagues where invite_code = v_code);
  end loop;
  return v_code;
end $$;

-- Lunes a las 00:00 (hora de España) al menos `p_min_days` días después de `p_from`.
create or replace function public._league_week_end(p_from timestamptz, p_min_days int default 4)
returns timestamptz
language sql
stable
as $$
  select (
    date_trunc('week', ((p_from + make_interval(days => p_min_days)) at time zone 'Europe/Madrid')) + interval '7 days'
  ) at time zone 'Europe/Madrid'
$$;

-- Crea una temporada de 10 jornadas semanales. La 1.ª abre ya (o al acabar la anterior).
create or replace function public._league_create_season(p_league bigint, p_number int, p_start timestamptz)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season bigint;
  v_first_close timestamptz := _league_week_end(p_start);
  i int;
begin
  insert into league_seasons (league_id, number, starts_on, ends_on)
  values (p_league, p_number, (p_start at time zone 'Europe/Madrid')::date,
          ((v_first_close + interval '63 days') at time zone 'Europe/Madrid')::date)
  returning id into v_season;

  for i in 1..10 loop
    insert into matchdays (league_season_id, number, opens_at, closes_at, status)
    values (v_season, i,
            case when i = 1 then p_start else v_first_close + make_interval(days => 7 * (i - 2)) end,
            v_first_close + make_interval(days => 7 * (i - 1)),
            'scheduled');
  end loop;
  return v_season;
end $$;

-- Temática de una jornada: rota por las categorías con al menos 10 preguntas del rango de la
-- liga. Cada 5.ª jornada es mixta. Si ninguna categoría llega, todas son mixtas.
create or replace function public._league_theme(p_league leagues, p_number int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with cats as (
    select c.id, row_number() over (order by array_position(
             array['champions','mundial','premios','fichajes','leyendas','eurocopa','records','liga','trayectorias'],
             c.slug::text), c.id) as ord
    from question_categories c
    where (select count(*) from questions q
           where q.category_id = c.id and q.status = 'published' and q.kind = 'quiz'
             and q.difficulty between p_league.difficulty_min and p_league.difficulty_max) >= 10
  )
  select case when p_number % 5 = 0 or (select count(*) from cats) = 0 then null
              else (select id from cats
                    where ord = 1 + ((p_number - 1 - (p_number - 1) / 5) % (select count(*) from cats))) end
$$;

-- Abre una jornada: temática, 10 preguntas (iguales para toda la liga) y, en 1 contra 1,
-- el calendario de enfrentamientos con los miembros actuales (todos contra todos).
create or replace function public._league_open_matchday(p_md bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_md matchdays;
  v_league leagues;
  v_cat int;
  v_users uuid[];
  v_n int;
  v_round int;
  v_rot uuid[];
  i int;
begin
  select * into v_md from matchdays where id = p_md for update;
  if v_md.status <> 'scheduled' then
    return;
  end if;
  select l.* into v_league from leagues l join league_seasons ls on ls.league_id = l.id
  where ls.id = v_md.league_season_id;

  v_cat := _league_theme(v_league, v_md.number);
  update matchdays set status = 'open', category_id = v_cat,
    theme_label = coalesce((select name_es from question_categories where id = v_cat), 'Mixta')
  where id = p_md;

  -- Preguntas: primero de la temática y del rango; completa con el rango; nunca repite
  -- preguntas de jornadas anteriores de la misma liga.
  insert into matchday_questions (matchday_id, question_id, position)
  select p_md, picked.id, row_number() over (order by picked.ord)
  from (
    select q.id,
           (case when v_cat is null or q.category_id = v_cat then 0 else 1 end) * 10
           + case when q.difficulty between v_league.difficulty_min and v_league.difficulty_max then 0
                  else 5 + least(abs(q.difficulty - v_league.difficulty_min), abs(q.difficulty - v_league.difficulty_max)) end
           + random() * case when v_league.difficulty_old and coalesce(q.era_to, 9999) < 1990 then 0.5 else 1 end as ord
    from questions q
    where q.status = 'published' and q.kind = 'quiz' and q.format = 'multiple_choice'
      and not exists (
        select 1 from matchday_questions mq
        join matchdays m on m.id = mq.matchday_id
        join league_seasons s on s.id = m.league_season_id
        where s.league_id = v_league.id and mq.question_id = q.id)
    order by 2
    limit 10
  ) picked;

  if v_league.format = 'head_to_head' then
    select array_agg(user_id order by joined_at, user_id) into v_users
    from league_members where league_id = v_league.id;
    v_n := coalesce(array_length(v_users, 1), 0);
    if v_n >= 2 then
      if v_n % 2 = 1 then
        v_users := v_users || null::uuid;  -- uno descansa
        v_n := v_n + 1;
      end if;
      -- Método del círculo: el primero fijo, el resto rota una posición por jornada.
      v_round := (v_md.number - 1) % (v_n - 1);
      v_rot := v_users[1:1];
      for i in 0..(v_n - 2) loop
        v_rot := v_rot || v_users[2 + ((i + v_round) % (v_n - 1))];
      end loop;
      for i in 1..(v_n / 2) loop
        if v_rot[i] is null then
          insert into fixtures (matchday_id, home_user_id, away_user_id) values (p_md, v_rot[v_n + 1 - i], null);
        elsif v_rot[v_n + 1 - i] is null then
          insert into fixtures (matchday_id, home_user_id, away_user_id) values (p_md, v_rot[i], null);
        elsif v_md.number % 2 = 0 then
          insert into fixtures (matchday_id, home_user_id, away_user_id) values (p_md, v_rot[v_n + 1 - i], v_rot[i]);
        else
          insert into fixtures (matchday_id, home_user_id, away_user_id) values (p_md, v_rot[i], v_rot[v_n + 1 - i]);
        end if;
      end loop;
    end if;
  end if;
end $$;

-- Recalcula la clasificación de una temporada a partir de las jornadas cerradas.
-- Puntos: en "points", los puntos de juego; en "head_to_head", 3/1/0.
-- Desempate: puntos de juego → aciertos.
create or replace function public._league_recompute_standings(p_season bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_format league_format;
  v_league bigint;
begin
  select l.format, l.id into v_format, v_league
  from leagues l join league_seasons s on s.league_id = l.id where s.id = p_season;

  delete from standings where league_season_id = p_season;
  insert into standings (league_season_id, user_id, position, played, won, drawn, lost, points, total_score)
  select p_season, m.user_id,
         row_number() over (order by case when v_format = 'head_to_head' then r.lp else r.total end desc,
                                     r.total desc, r.correct desc, m.joined_at, m.user_id),
         r.played, f.won, f.drawn, f.lost,
         case when v_format = 'head_to_head' then r.lp else r.total end,
         r.total
  from league_members m
  cross join lateral (
    select count(*) filter (where x.played)::int as played,
           coalesce(sum(x.score), 0)::int as total,
           coalesce(sum(x.correct_count), 0)::int as correct,
           coalesce(sum(x.league_points), 0)::int as lp
    from matchday_results x
    join matchdays md on md.id = x.matchday_id and md.league_season_id = p_season and md.status = 'closed'
    where x.user_id = m.user_id
  ) r
  cross join lateral (
    select count(*) filter (where y.outcome = 'W')::int as won,
           count(*) filter (where y.outcome = 'D')::int as drawn,
           count(*) filter (where y.outcome = 'L')::int as lost
    from matchday_results y
    join matchdays md on md.id = y.matchday_id and md.league_season_id = p_season and md.status = 'closed'
    where y.user_id = m.user_id
  ) f
  where m.league_id = v_league;
end $$;

-- Cierra una jornada: termina las partidas a medias, guarda resultados, resuelve los
-- enfrentamientos y recalcula la clasificación.
create or replace function public._league_close_matchday(p_md bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_md matchdays;
  v_league bigint;
  v_row record;
begin
  select * into v_md from matchdays where id = p_md for update;
  if v_md.status <> 'open' then
    return;
  end if;
  select league_id into v_league from league_seasons where id = v_md.league_season_id;

  -- Partidas sin terminar: cuentan con lo respondido.
  for v_row in
    select gs.id, gs.started_at from matchday_plays mp
    join game_sessions gs on gs.id = mp.session_id and gs.started_at = mp.session_started
    where mp.matchday_id = p_md and gs.status = 'started'
  loop
    perform _game_finish(v_row.id, v_row.started_at, 'abandoned');
  end loop;

  insert into matchday_results (matchday_id, user_id, score, correct_count, played)
  select p_md, m.user_id, coalesce(gs.score, 0), coalesce(gs.correct_count, 0), gs.id is not null
  from league_members m
  left join matchday_plays mp on mp.matchday_id = p_md and mp.user_id = m.user_id
  left join game_sessions gs on gs.id = mp.session_id and gs.started_at = mp.session_started
  where m.league_id = v_league
  on conflict (matchday_id, user_id) do update set
    score = excluded.score, correct_count = excluded.correct_count, played = excluded.played;

  update fixtures f set
    home_score = coalesce((select score from matchday_results where matchday_id = p_md and user_id = f.home_user_id), 0),
    away_score = case when f.away_user_id is null then null
                      else coalesce((select score from matchday_results where matchday_id = p_md and user_id = f.away_user_id), 0) end
  where f.matchday_id = p_md;
  -- Quien no juega pierde. Si solo juega uno, gana ese. Si no juega ninguno, pierden los dos.
  update fixtures f set winner_user_id = case
      when f.away_user_id is null then null
      when hp.played and not ap.played then f.home_user_id
      when ap.played and not hp.played then f.away_user_id
      when not hp.played and not ap.played then null
      when f.home_score > f.away_score then f.home_user_id
      when f.away_score > f.home_score then f.away_user_id
      else null end
  from matchday_results hp, matchday_results ap
  where f.matchday_id = p_md
    and hp.matchday_id = p_md and hp.user_id = f.home_user_id
    and ap.matchday_id = p_md and ap.user_id = f.away_user_id;

  update matchday_results r set outcome = (
    select case when f.away_user_id is null then 'R'
                when f.winner_user_id = r.user_id then 'W'
                when f.winner_user_id is null and r.played then 'D'
                else 'L' end
    from fixtures f where f.matchday_id = p_md and r.user_id in (f.home_user_id, f.away_user_id) limit 1)
  where r.matchday_id = p_md;
  -- 3 por victoria, 1 por empate.
  update matchday_results set league_points = case outcome when 'W' then 3 when 'D' then 1 else 0 end
  where matchday_id = p_md;

  update matchdays set status = 'closed' where id = p_md;
  perform _league_recompute_standings(v_md.league_season_id);
end $$;

-- Fin de temporada: campeón, trofeos (campeón y máximo acertante) y temporada siguiente.
create or replace function public._league_finish_season(p_season bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s league_seasons;
  v_league leagues;
  v_champion uuid;
  v_top uuid;
  v_last_close timestamptz;
begin
  select * into v_s from league_seasons where id = p_season for update;
  if v_s.status <> 'active' then
    return;
  end if;
  select * into v_league from leagues where id = v_s.league_id;

  select user_id into v_champion from standings where league_season_id = p_season and position = 1;
  select r.user_id into v_top from matchday_results r join matchdays md on md.id = r.matchday_id
  where md.league_season_id = p_season
  group by r.user_id having sum(r.correct_count) > 0
  order by sum(r.correct_count) desc, sum(r.score) desc limit 1;

  update league_seasons set status = 'finished', champion_user_id = v_champion where id = p_season;
  if v_champion is not null then
    insert into user_trophies (user_id, league_season_id, league_id, title)
    values (v_champion, p_season, v_league.id, format('Campeón · %s · Temporada %s', v_league.name, v_s.number));
  end if;
  if v_top is not null then
    insert into user_trophies (user_id, league_season_id, league_id, title)
    values (v_top, p_season, v_league.id, format('Máximo acertante · %s · Temporada %s', v_league.name, v_s.number));
  end if;

  if v_league.deleted_at is null then
    select max(closes_at) into v_last_close from matchdays where league_season_id = p_season;
    perform _league_create_season(v_league.id, v_s.number + 1, greatest(v_last_close, now()));
  end if;
end $$;

-- Pone al día una liga: cierra las jornadas vencidas, abre las que tocan y cierra la
-- temporada si ha terminado. Idempotente: se llama al verla, al jugar y desde pg_cron.
create or replace function public.league_tick(p_league bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season league_seasons;
  v_md record;
begin
  -- Un solo tick a la vez por liga.
  perform pg_advisory_xact_lock(hashtext('league_tick'), p_league::int);
  for v_season in
    select * from league_seasons where league_id = p_league and status = 'active' order by number
  loop
    for v_md in
      select id from matchdays where league_season_id = v_season.id and status = 'open' and closes_at <= now()
      order by number
    loop
      perform _league_close_matchday(v_md.id);
    end loop;
    if not exists (select 1 from matchdays where league_season_id = v_season.id and status <> 'closed') then
      perform _league_finish_season(v_season.id);
    end if;
  end loop;

  for v_md in
    select md.id from matchdays md join league_seasons s on s.id = md.league_season_id
    where s.league_id = p_league and s.status = 'active' and md.status = 'scheduled' and md.opens_at <= now()
    order by md.number
  loop
    perform _league_open_matchday(v_md.id);
  end loop;
end $$;

create or replace function public.league_tick_all()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_n int := 0;
begin
  for v_id in
    select distinct s.league_id from league_seasons s
    join matchdays md on md.league_season_id = s.id
    join leagues l on l.id = s.league_id and l.deleted_at is null
    where s.status = 'active'
      and ((md.status = 'open' and md.closes_at <= now()) or (md.status = 'scheduled' and md.opens_at <= now()))
  loop
    perform league_tick(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.league_create(
  p_user uuid, p_name text, p_format text, p_level text, p_min int, p_max int, p_old boolean)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not _valid_difficulty(p_level) or p_format not in ('points', 'head_to_head')
     or char_length(trim(p_name)) not between 3 and 40 then
    raise exception 'invalid_input';
  end if;
  if (select count(*) from leagues where owner_id = p_user and deleted_at is null) >= 10 then
    raise exception 'league_limit';
  end if;
  insert into leagues (name, owner_id, visibility, format, invite_code, difficulty, difficulty_min, difficulty_max, difficulty_old)
  values (trim(p_name), p_user, 'private', p_format::league_format, _league_new_code(), p_level, p_min, p_max, coalesce(p_old, false))
  returning id into v_id;
  insert into league_members (league_id, user_id, role) values (v_id, p_user, 'owner');
  perform _league_recompute_standings(_league_create_season(v_id, 1, now()));
  perform league_tick(v_id);
  return v_id;
end $$;

create or replace function public.league_join(p_user uuid, p_code text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l leagues;
begin
  select * into v_l from leagues where invite_code = upper(trim(p_code)) and deleted_at is null for update;
  if v_l.id is null then
    raise exception 'league_not_found';
  end if;
  if exists (select 1 from league_members where league_id = v_l.id and user_id = p_user) then
    return v_l.id;
  end if;
  if (select count(*) from league_members where league_id = v_l.id) >= v_l.max_members then
    raise exception 'league_full';
  end if;
  insert into league_members (league_id, user_id) values (v_l.id, p_user);
  perform _league_recompute_standings(s.id) from league_seasons s where s.league_id = v_l.id and s.status = 'active';
  return v_l.id;
end $$;

-- Salir de una liga. El dueño no sale: la elimina (sus resultados se conservan).
create or replace function public.league_leave(p_user uuid, p_league bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l leagues;
begin
  select * into v_l from leagues where id = p_league and deleted_at is null;
  if v_l.id is null or not exists (select 1 from league_members where league_id = p_league and user_id = p_user) then
    raise exception 'not_member';
  end if;
  if v_l.owner_id = p_user then
    update leagues set deleted_at = now() where id = p_league;
  else
    delete from league_members where league_id = p_league and user_id = p_user;
    perform _league_recompute_standings(s.id) from league_seasons s where s.league_id = p_league and s.status = 'active';
  end if;
end $$;

-- Mis ligas, con la jornada en curso y mi posición.
create or replace function public.league_list(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.joined desc), '[]'::jsonb) from (
    select l.id, l.name, l.format, l.difficulty, m.joined_at as joined, (l.owner_id = p_user) as "isOwner",
           (select count(*) from league_members where league_id = l.id) as members,
           s.number as season,
           md.number as matchday, md.theme_label as theme, md.closes_at as "closesAt",
           exists (select 1 from matchday_plays mp where mp.matchday_id = md.id and mp.user_id = p_user) as played,
           (select position from standings where league_season_id = s.id and user_id = p_user) as position
    from league_members m
    join leagues l on l.id = m.league_id and l.deleted_at is null
    left join lateral (select * from league_seasons where league_id = l.id and status = 'active' order by number desc limit 1) s on true
    left join lateral (select * from matchdays where league_season_id = s.id and status = 'open' order by number limit 1) md on true
    where m.user_id = p_user
  ) x
$$;

-- Vista completa de una liga para uno de sus miembros.
create or replace function public.league_view(p_user uuid, p_league bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l leagues;
  v_s league_seasons;
  v_md matchdays;
  v_last matchdays;
begin
  select * into v_l from leagues where id = p_league and deleted_at is null;
  if v_l.id is null or not exists (select 1 from league_members where league_id = p_league and user_id = p_user) then
    raise exception 'not_member';
  end if;
  perform league_tick(p_league);

  select * into v_s from league_seasons where league_id = p_league order by (status = 'active') desc, number desc limit 1;
  select * into v_md from matchdays where league_season_id = v_s.id and status = 'open' order by number limit 1;
  select * into v_last from matchdays where league_season_id = v_s.id and status = 'closed' order by number desc limit 1;

  return jsonb_build_object(
    'id', v_l.id, 'name', v_l.name, 'format', v_l.format, 'difficulty', v_l.difficulty,
    'inviteCode', v_l.invite_code, 'isOwner', v_l.owner_id = p_user, 'maxMembers', v_l.max_members,
    'season', jsonb_build_object('id', v_s.id, 'number', v_s.number, 'status', v_s.status),
    'members', (select jsonb_agg(jsonb_build_object('userId', u.id, 'username', u.username, 'role', m.role,
                                                   'isMe', u.id = p_user) order by m.joined_at)
                from league_members m join users u on u.id = m.user_id where m.league_id = p_league),
    'standings', (select coalesce(jsonb_agg(jsonb_build_object(
                    'position', st.position, 'userId', st.user_id, 'username', u.username, 'isMe', st.user_id = p_user,
                    'played', st.played, 'won', st.won, 'drawn', st.drawn, 'lost', st.lost,
                    'points', st.points, 'totalScore', st.total_score) order by st.position), '[]'::jsonb)
                  from standings st join users u on u.id = st.user_id where st.league_season_id = v_s.id),
    'matchdays', (select jsonb_agg(jsonb_build_object('id', id, 'number', number, 'theme', theme_label,
                                                     'opensAt', opens_at, 'closesAt', closes_at, 'status', status)
                                   order by number)
                  from matchdays where league_season_id = v_s.id),
    'current', case when v_md.id is null then null else jsonb_build_object(
      'id', v_md.id, 'number', v_md.number, 'theme', v_md.theme_label, 'closesAt', v_md.closes_at,
      'questions', (select count(*) from matchday_questions where matchday_id = v_md.id),
      'myStatus', (select case when gs.status = 'started' then 'playing' else 'played' end
                   from matchday_plays mp join game_sessions gs on gs.id = mp.session_id and gs.started_at = mp.session_started
                   where mp.matchday_id = v_md.id and mp.user_id = p_user),
      'results', (select coalesce(jsonb_agg(jsonb_build_object(
                    'userId', u.id, 'username', u.username, 'isMe', u.id = p_user,
                    'score', gs.score, 'correct', gs.correct_count, 'finished', gs.status <> 'started')
                    order by gs.score desc), '[]'::jsonb)
                  from matchday_plays mp
                  join game_sessions gs on gs.id = mp.session_id and gs.started_at = mp.session_started
                  join users u on u.id = mp.user_id
                  where mp.matchday_id = v_md.id),
      'fixtures', (select coalesce(jsonb_agg(jsonb_build_object(
                     'home', hu.username, 'away', au.username,
                     'homeIsMe', f.home_user_id = p_user, 'awayIsMe', f.away_user_id = p_user,
                     'homeScore', (select gs.score from matchday_plays mp join game_sessions gs on gs.id = mp.session_id
                                   and gs.started_at = mp.session_started where mp.matchday_id = v_md.id and mp.user_id = f.home_user_id),
                     'awayScore', (select gs.score from matchday_plays mp join game_sessions gs on gs.id = mp.session_id
                                   and gs.started_at = mp.session_started where mp.matchday_id = v_md.id and mp.user_id = f.away_user_id))
                     order by f.id), '[]'::jsonb)
                   from fixtures f join users hu on hu.id = f.home_user_id left join users au on au.id = f.away_user_id
                   where f.matchday_id = v_md.id)) end,
    'last', case when v_last.id is null then null else jsonb_build_object(
      'number', v_last.number, 'theme', v_last.theme_label,
      'results', (select coalesce(jsonb_agg(jsonb_build_object('username', u.username, 'isMe', u.id = p_user,
                    'score', r.score, 'correct', r.correct_count, 'played', r.played, 'points', r.league_points)
                    order by r.score desc), '[]'::jsonb)
                  from matchday_results r join users u on u.id = r.user_id where r.matchday_id = v_last.id),
      'fixtures', (select coalesce(jsonb_agg(jsonb_build_object('home', hu.username, 'away', au.username,
                     'homeScore', f.home_score, 'awayScore', f.away_score,
                     'homeIsMe', f.home_user_id = p_user, 'awayIsMe', f.away_user_id = p_user) order by f.id), '[]'::jsonb)
                   from fixtures f join users hu on hu.id = f.home_user_id left join users au on au.id = f.away_user_id
                   where f.matchday_id = v_last.id)) end,
    'champion', (select u.username from league_seasons s join users u on u.id = s.champion_user_id
                 where s.league_id = p_league and s.status = 'finished' order by s.number desc limit 1));
end $$;

-- Empieza (o retoma) la jornada de liga abierta. Una partida por jugador y jornada.
create or replace function public.game_start_league(p_user uuid, p_matchday bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_md matchdays;
  v_l leagues;
  v_mode int;
  v_session uuid := gen_random_uuid();
  v_started timestamptz := now();
  v_play matchday_plays;
  v_s game_sessions;
  v_total int;
begin
  select l.* into v_l from leagues l
  join league_seasons s on s.league_id = l.id
  join matchdays md on md.league_season_id = s.id
  where md.id = p_matchday and l.deleted_at is null;
  if v_l.id is null or not exists (select 1 from league_members where league_id = v_l.id and user_id = p_user) then
    raise exception 'not_member';
  end if;
  perform league_tick(v_l.id);

  select * into v_play from matchday_plays where matchday_id = p_matchday and user_id = p_user;
  if v_play.session_id is not null then
    select * into v_s from game_sessions where id = v_play.session_id and started_at = v_play.session_started;
    return jsonb_build_object(
      'sessionId', v_s.id, 'mode', 'league', 'total', _game_session_total(v_s), 'difficulty', v_s.difficulty,
      'status', v_s.status, 'score', v_s.score, 'correctCount', v_s.correct_count,
      'answered', (select count(*) from session_answers where session_id = v_s.id and answered_at is not null),
      'resumed', true);
  end if;

  select * into v_md from matchdays where id = p_matchday;
  if v_md.status <> 'open' or v_md.closes_at <= now() then
    raise exception 'matchday_closed';
  end if;
  v_total := (select count(*) from matchday_questions where matchday_id = p_matchday);
  if v_total = 0 then
    raise exception 'no_questions';
  end if;
  select id into v_mode from game_modes where slug = 'league';

  insert into matchday_plays (matchday_id, user_id, session_id, session_started)
  values (p_matchday, p_user, v_session, v_started);
  insert into game_sessions (id, started_at, user_id, game_mode_id, matchday_id, status, question_total,
                             difficulty, difficulty_min, difficulty_max, difficulty_old)
  values (v_session, v_started, p_user, v_mode, p_matchday, 'started', v_total,
          v_l.difficulty, v_l.difficulty_min, v_l.difficulty_max, v_l.difficulty_old);

  return jsonb_build_object(
    'sessionId', v_session, 'mode', 'league', 'total', v_total, 'difficulty', v_l.difficulty,
    'status', 'started', 'score', 0, 'correctCount', 0, 'answered', 0, 'resumed', false);
end $$;

-- Cambiar el nivel por defecto del jugador.
create or replace function public.user_set_difficulty(p_user uuid, p_level text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not _valid_difficulty(p_level) then
    raise exception 'invalid_input';
  end if;
  update users set difficulty = p_level where id = p_user;
end $$;

-- ---------------------------------------------------------------------
-- 5) PERMISOS Y TAREAS
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    '_game_pick_question(uuid,timestamptz,uuid,text,int,int,boolean)', '_game_session_total(public.game_sessions)',
    'game_start(uuid,uuid,text,text,int,int,text,int,int,boolean)', 'game_next(uuid,uuid,uuid,text)',
    'game_submit(uuid,uuid,uuid,int,text,text,text)', 'game_abandon(uuid,uuid,uuid)', 'game_summary(uuid,uuid,uuid)',
    '_league_new_code()', '_league_create_season(bigint,int,timestamptz)', '_league_theme(public.leagues,int)',
    '_league_open_matchday(bigint)', '_league_recompute_standings(bigint)', '_league_close_matchday(bigint)',
    '_league_finish_season(bigint)', 'league_tick(bigint)', 'league_tick_all()',
    'league_create(uuid,text,text,text,int,int,boolean)', 'league_join(uuid,text)', 'league_leave(uuid,bigint)',
    'league_list(uuid)', 'league_view(uuid,bigint)', 'game_start_league(uuid,bigint)',
    'user_set_difficulty(uuid,text)'
  ] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon, authenticated', f);
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ctv-ligas', '*/10 * * * *', 'select public.league_tick_all()');
  end if;
end $$;
