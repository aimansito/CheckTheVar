-- =====================================================================
--  CHECK THE VAR — Correcciones del esquema inicial + motor del reto diario
--  1) Particiones   2) Un reto diario por jugador   3) Perfil ↔ auth.users
--  4) Índices/FK    5) Motor de partida (funciones solo para el servidor)
--  6) RLS           7) Tareas programadas
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PARTICIONES: default + meses siguientes + función para crearlas
-- ---------------------------------------------------------------------
create or replace function public.ensure_month_partitions(p_months_ahead int default 2)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_suffix text;
  v_parent text;
  i int;
begin
  for i in 0 .. p_months_ahead loop
    v_month  := (date_trunc('month', now()) + make_interval(months => i))::date;
    v_suffix := to_char(v_month, 'YYYY_MM');
    foreach v_parent in array array['game_sessions', 'session_answers'] loop
      if to_regclass(format('public.%I', v_parent || '_' || v_suffix)) is null then
        execute format(
          'create table public.%I partition of public.%I for values from (%L) to (%L)',
          v_parent || '_' || v_suffix, v_parent, v_month, (v_month + interval '1 month')::date
        );
        execute format('alter table public.%I enable row level security', v_parent || '_' || v_suffix);
      end if;
    end loop;
  end loop;
end $$;

select public.ensure_month_partitions(6);

-- Red de seguridad: si el job falla, las filas caen aquí en vez de dar error.
create table public.game_sessions_default   partition of public.game_sessions   default;
create table public.session_answers_default partition of public.session_answers default;

-- ---------------------------------------------------------------------
-- 2) UN RETO DIARIO POR JUGADOR
--    El índice único de una tabla particionada debe incluir started_at, así que
--    one_play_per_challenge no impedía nada. daily_plays hace de candado.
-- ---------------------------------------------------------------------
drop index if exists public.one_play_per_challenge;

create table public.daily_plays (
  challenge_id     bigint not null references public.daily_challenges(id) on delete cascade,
  user_id          uuid references public.users(id) on delete cascade,
  guest_id         uuid references public.guest_sessions(id) on delete cascade,
  session_id       uuid not null,
  session_started  timestamptz not null,
  created_at       timestamptz not null default now(),
  check ((user_id is null) <> (guest_id is null))
);
create unique index daily_plays_user  on public.daily_plays(challenge_id, user_id)  where user_id  is not null;
create unique index daily_plays_guest on public.daily_plays(challenge_id, guest_id) where guest_id is not null;
create index daily_plays_session on public.daily_plays(session_id);

-- ---------------------------------------------------------------------
-- 3) PERFIL ENLAZADO CON SUPABASE AUTH
-- ---------------------------------------------------------------------
alter table public.users alter column email drop not null;   -- login por teléfono / Apple sin email
alter table public.users
  add constraint users_auth_fk foreign key (id) references auth.users(id) on delete cascade;

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

  insert into public.users (id, username, email, display_name)
  values (new.id, v_candidate, new.email,
          coalesce(new.raw_user_meta_data ->> 'display_name', v_candidate));
  insert into public.user_stats (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- 4) FK E ÍNDICES QUE FALTABAN
-- ---------------------------------------------------------------------
alter table public.game_sessions
  add constraint game_sessions_matchday_fk foreign key (matchday_id) references public.matchdays(id);

alter table public.session_answers add column choice char(1);          -- letra elegida (A/B/C)
alter table public.session_answers add column scored_at timestamptz;   -- puntos ya sumados

create index session_answers_question     on public.session_answers(question_id);
create index daily_challenge_questions_q  on public.daily_challenge_questions(question_id);
create index league_members_user          on public.league_members(user_id);
create index game_sessions_guest          on public.game_sessions(guest_id, started_at desc);
create index game_sessions_open           on public.game_sessions(status, started_at) where status = 'started';

-- ---------------------------------------------------------------------
-- 5) MOTOR DE PARTIDA
--    Solo lo ejecuta el servidor (service_role). El cliente nunca ve is_correct.
--    Los PUNTOS no se calculan aquí: los calcula packages/shared/src/scoring.ts
--    y se guardan con game_record_score (única fuente de los valores).
-- ---------------------------------------------------------------------

-- Fecha del reto diario: horario de España.
create or replace function public.game_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Europe/Madrid')::date $$;

-- Crea (si no existe) el reto diario de una fecha con hasta 10 preguntas publicadas,
-- priorizando las que no han salido en los últimos 30 días.
create or replace function public.ensure_daily_challenge(p_date date)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode int;
  v_id bigint;
begin
  select id into v_mode from game_modes where slug = 'daily';
  if v_mode is null then
    raise exception 'daily_mode_missing';
  end if;

  select id into v_id from daily_challenges where game_mode_id = v_mode and challenge_date = p_date;
  if v_id is not null then
    return v_id;
  end if;

  insert into daily_challenges (game_mode_id, challenge_date)
  values (v_mode, p_date)
  on conflict (game_mode_id, challenge_date) do nothing
  returning id into v_id;

  if v_id is null then  -- otra petición lo creó a la vez
    select id into v_id from daily_challenges where game_mode_id = v_mode and challenge_date = p_date;
    return v_id;
  end if;

  insert into daily_challenge_questions (challenge_id, question_id, position)
  select v_id, picked.id, row_number() over (order by picked.ord)
  from (
    select q.id, random() as ord,
           exists (
             select 1 from daily_challenge_questions dcq
             join daily_challenges dc on dc.id = dcq.challenge_id
             where dcq.question_id = q.id and dc.challenge_date > p_date - 30
           ) as recent
    from questions q
    where q.status = 'published' and q.format = 'multiple_choice'
    order by recent, random()
    limit 10
  ) picked;

  return v_id;
end $$;

-- Sesión del jugador (comprueba que sea suya).
create or replace function public._game_owned_session(p_session uuid, p_user uuid, p_guest uuid)
returns public.game_sessions
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
begin
  select * into v_s from game_sessions
  where id = p_session
    and ((p_user is not null and user_id = p_user) or (p_guest is not null and guest_id = p_guest));
  if v_s.id is null then
    raise exception 'session_not_found';
  end if;
  return v_s;
end $$;

create or replace function public._game_total(p_challenge bigint)
returns int
language sql
stable
security definer
set search_path = public
as $$ select count(*)::int from daily_challenge_questions where challenge_id = p_challenge $$;

-- Invitado a partir del hash de su cookie (lo crea si hace falta).
create or replace function public.game_resolve_guest(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into guest_sessions (device_token) values (p_token_hash)
  on conflict (device_token) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from guest_sessions where device_token = p_token_hash;
  end if;
  return v_id;
end $$;

-- Empieza (o retoma) la partida del reto diario de hoy.
create or replace function public.game_start_daily(p_user uuid, p_guest uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge bigint;
  v_mode int;
  v_session uuid := gen_random_uuid();
  v_started timestamptz := now();
  v_play daily_plays;
  v_s game_sessions;
  v_total int;
  v_inserted int;
begin
  if (p_user is null) = (p_guest is null) then
    raise exception 'player_required';
  end if;

  v_challenge := ensure_daily_challenge(game_today());
  v_total := _game_total(v_challenge);
  if v_total = 0 then
    raise exception 'no_questions';
  end if;
  select id into v_mode from game_modes where slug = 'daily';

  insert into daily_plays (challenge_id, user_id, guest_id, session_id, session_started)
  values (v_challenge, p_user, p_guest, v_session, v_started)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    -- Ya lo jugó (o lo está jugando): se devuelve la misma partida. No se puede reiniciar.
    select * into v_play from daily_plays
    where challenge_id = v_challenge
      and ((p_user is not null and user_id = p_user) or (p_guest is not null and guest_id = p_guest));
    select * into v_s from game_sessions where id = v_play.session_id and started_at = v_play.session_started;
    return jsonb_build_object(
      'sessionId', v_s.id, 'mode', 'daily', 'total', v_total,
      'status', v_s.status, 'score', v_s.score, 'correctCount', v_s.correct_count,
      'answered', (select count(*) from session_answers where session_id = v_s.id and answered_at is not null),
      'resumed', true);
  end if;

  insert into game_sessions (id, started_at, user_id, guest_id, game_mode_id, challenge_id, status)
  values (v_session, v_started, p_user, p_guest, v_mode, v_challenge, 'started');

  if p_guest is not null then
    update guest_sessions set last_played_date = game_today() where id = p_guest;
  end if;

  return jsonb_build_object(
    'sessionId', v_session, 'mode', 'daily', 'total', v_total,
    'status', 'started', 'score', 0, 'correctCount', 0, 'answered', 0, 'resumed', false);
end $$;

-- Opciones de una pregunta, barajadas de forma estable por sesión, con su letra.
create or replace function public._game_options(p_session uuid, p_question bigint, p_lang text)
returns table (letter text, option_id bigint, label text, is_correct boolean)
language sql
stable
security definer
set search_path = public
as $$
  select chr(64 + (row_number() over (order by md5(p_session::text || o.id::text)))::int) as letter,
         o.id, coalesce(t.label, t_es.label), o.is_correct
  from question_options o
  left join question_option_translations t    on t.option_id = o.id and t.language = p_lang
  left join question_option_translations t_es on t_es.option_id = o.id and t_es.language = 'es'
  where o.question_id = p_question
  order by md5(p_session::text || o.id::text)
$$;

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
  v_prompt text;
  v_category text;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  if v_s.status <> 'started' then
    return jsonb_build_object('done', true, 'status', v_s.status);
  end if;
  v_total := _game_total(v_s.challenge_id);

  select * into v_pending from session_answers
  where session_id = v_s.id and session_started = v_s.started_at and answered_at is null
  order by position limit 1;

  if v_pending.session_id is null then
    select count(*) into v_answered from session_answers
    where session_id = v_s.id and session_started = v_s.started_at;
    if v_answered >= v_total then
      return jsonb_build_object('done', true, 'status', v_s.status);
    end if;

    select question_id into v_question from daily_challenge_questions
    where challenge_id = v_s.challenge_id and position = v_answered + 1;

    insert into session_answers (session_id, session_started, question_id, position, shown_at)
    values (v_s.id, v_s.started_at, v_question, v_answered + 1, now())
    returning * into v_pending;
  end if;

  select coalesce(t.prompt, t_es.prompt), c.slug
  into v_prompt, v_category
  from questions q
  join question_categories c on c.id = q.category_id
  left join question_translations t    on t.question_id = q.id and t.language = p_lang
  left join question_translations t_es on t_es.question_id = q.id and t_es.language = 'es'
  where q.id = v_pending.question_id;

  return jsonb_build_object(
    'done', false,
    'sessionId', v_s.id,
    'position', v_pending.position,
    'total', v_total,
    'format', 'multiple_choice',
    'prompt', v_prompt,
    'category', v_category,
    'elapsedMs', floor(extract(epoch from (now() - v_pending.shown_at)) * 1000)::int,
    'options', (select jsonb_agg(jsonb_build_object('id', o.letter, 'label', o.label) order by o.letter)
                from _game_options(v_s.id, v_pending.question_id, p_lang) o));
end $$;

-- CHECK THE VAR: registra la respuesta (una sola vez) y devuelve la corrección en bruto.
-- Si ya se respondió, devuelve lo guardado (idempotente).
create or replace function public.game_submit(
  p_session uuid, p_user uuid, p_guest uuid, p_position int, p_choice text, p_lang text default 'es')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_a session_answers;
  v_option bigint;
  v_correct_letter text;
  v_correct_label text;
  v_raw_correct boolean;
  v_last_miss int;
  v_explanation text;
  v_total int;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  v_total := _game_total(v_s.challenge_id);

  select * into v_a from session_answers
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
  for update;
  if v_a.session_id is null then
    raise exception 'question_not_shown';
  end if;

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
      'position', p_position, 'total', v_total, 'isLast', p_position >= v_total,
      'choice', v_a.choice, 'rawCorrect', coalesce(v_a.choice = v_correct_letter, false),
      'isCorrect', v_a.is_correct, 'points', v_a.points,
      'elapsedMs', floor(extract(epoch from (v_a.answered_at - v_a.shown_at)) * 1000)::int,
      'streakBefore', p_position - 1 - coalesce(v_last_miss, 0),
      'correctOptionId', v_correct_letter, 'correctLabel', v_correct_label,
      'explanation', v_explanation, 'sessionScore', v_s.score);
  end if;

  if v_s.status <> 'started' then
    raise exception 'session_closed';
  end if;

  -- p_choice null = se acabó el tiempo sin responder (cuenta como fallo).
  if p_choice is not null then
    select o.option_id into v_option
    from _game_options(v_s.id, v_a.question_id, p_lang) o where o.letter = upper(p_choice);
    if v_option is null then
      raise exception 'invalid_choice';
    end if;
  end if;
  v_raw_correct := p_choice is not null and upper(p_choice) = v_correct_letter;

  update session_answers
  set answered_at = now(), option_id = v_option, choice = upper(p_choice)
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
  returning * into v_a;

  return jsonb_build_object(
    'alreadyAnswered', false, 'scored', false,
    'position', p_position, 'total', v_total, 'isLast', p_position >= v_total,
    'choice', v_a.choice, 'rawCorrect', v_raw_correct,
    'elapsedMs', floor(extract(epoch from (v_a.answered_at - v_a.shown_at)) * 1000)::int,
    'streakBefore', p_position - 1 - coalesce(v_last_miss, 0),
    'correctOptionId', v_correct_letter, 'correctLabel', v_correct_label,
    'explanation', v_explanation, 'sessionScore', v_s.score);
end $$;

-- Suma una partida terminada a las estadísticas del usuario (racha diaria incluida).
-- p_add_points = false cuando los puntos ya se sumaron (traspaso de invitado).
create or replace function public._game_credit_user(
  p_user uuid, p_session uuid, p_started timestamptz, p_add_points boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_day date;
  v_answers int;
  v_points int;
begin
  select * into v_s from game_sessions where id = p_session and started_at = p_started;
  select challenge_date into v_day from daily_challenges where id = v_s.challenge_id;
  select count(*) into v_answers from session_answers
  where session_id = v_s.id and session_started = v_s.started_at and answered_at is not null;
  v_points := case when p_add_points then v_s.score else 0 end;

  insert into user_stats (user_id) values (p_user) on conflict (user_id) do nothing;
  update user_stats us set
    total_points    = us.total_points + v_points,
    xp              = us.xp + v_points,
    games_played    = us.games_played + 1,
    answers_correct = us.answers_correct + v_s.correct_count,
    answers_total   = us.answers_total + v_answers,
    current_streak  = case
                        when v_day is null then us.current_streak
                        when us.last_daily_date >= v_day then us.current_streak
                        when us.last_daily_date = v_day - 1 then us.current_streak + 1
                        else 1 end,
    best_streak     = greatest(us.best_streak, case
                        when v_day is null then us.current_streak
                        when us.last_daily_date >= v_day then us.current_streak
                        when us.last_daily_date = v_day - 1 then us.current_streak + 1
                        else 1 end),
    last_daily_date = greatest(us.last_daily_date, v_day),
    updated_at      = now()
  where us.user_id = p_user;

  insert into user_category_stats (user_id, category_id, answers_correct, answers_total)
  select p_user, q.category_id, count(*) filter (where sa.is_correct), count(*)
  from session_answers sa join questions q on q.id = sa.question_id
  where sa.session_id = v_s.id and sa.session_started = v_s.started_at and sa.answered_at is not null
  group by q.category_id
  on conflict (user_id, category_id) do update set
    answers_correct = user_category_stats.answers_correct + excluded.answers_correct,
    answers_total   = user_category_stats.answers_total + excluded.answers_total;
end $$;

-- Cierra una partida y vuelca estadísticas (una sola vez).
create or replace function public._game_finish(p_session uuid, p_started timestamptz, p_status session_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
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
  else
    perform _game_credit_user(v_s.user_id, v_s.id, v_s.started_at, true);
  end if;
end $$;

-- Guarda los puntos calculados por scoring.ts. Idempotente: solo la primera vez cuenta.
create or replace function public.game_record_score(
  p_session uuid, p_user uuid, p_guest uuid, p_position int,
  p_counted boolean, p_points int, p_elapsed_ms int)
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
  v_total := _game_total(v_s.challenge_id);

  update session_answers
  set is_correct = p_counted, points = p_points, scored_at = now()
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
    and answered_at is not null and scored_at is null
  returning * into v_a;

  if v_a.session_id is not null then
    update game_sessions
    set score = score + p_points,
        correct_count = correct_count + case when p_counted then 1 else 0 end
    where id = v_s.id and started_at = v_s.started_at
    returning * into v_s;

    insert into question_stats (question_id, times_shown, times_correct, avg_time_ms)
    values (v_a.question_id, 1, case when p_counted then 1 else 0 end, p_elapsed_ms)
    on conflict (question_id) do update set
      avg_time_ms   = ((coalesce(question_stats.avg_time_ms, 0)::bigint * question_stats.times_shown
                        + p_elapsed_ms) / (question_stats.times_shown + 1))::int,
      times_shown   = question_stats.times_shown + 1,
      times_correct = question_stats.times_correct + excluded.times_correct;

    if p_position >= v_total then
      perform _game_finish(v_s.id, v_s.started_at, 'finished');
      select * into v_s from game_sessions where id = v_s.id and started_at = v_s.started_at;
    end if;
  end if;

  return jsonb_build_object(
    'sessionScore', v_s.score, 'correctCount', v_s.correct_count,
    'status', v_s.status, 'total', v_total);
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
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  return jsonb_build_object(
    'sessionId', v_s.id, 'mode', 'daily', 'status', v_s.status,
    'score', v_s.score, 'correctCount', v_s.correct_count,
    'total', _game_total(v_s.challenge_id),
    'pendingPoints', (select pending_points from guest_sessions where id = v_s.guest_id),
    'streak', (select current_streak from user_stats where user_id = v_s.user_id));
end $$;

-- Al registrarse: los puntos y la partida de hoy del invitado pasan a la cuenta.
create or replace function public.claim_guest(p_user uuid, p_guest uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points int;
  v_row record;
begin
  select pending_points into v_points from guest_sessions
  where id = p_guest and converted_user_id is null
  for update;
  if not found then
    return 0;  -- ya reclamado o no existe
  end if;

  update guest_sessions set pending_points = 0, converted_user_id = p_user where id = p_guest;

  insert into user_stats (user_id) values (p_user) on conflict (user_id) do nothing;
  update user_stats set total_points = total_points + v_points, xp = xp + v_points,
                        updated_at = now()
  where user_id = p_user;

  -- La partida del invitado pasa a ser del usuario (así no puede repetir el reto de hoy).
  update daily_plays dp set user_id = p_user, guest_id = null
  where dp.guest_id = p_guest
    and not exists (select 1 from daily_plays x where x.challenge_id = dp.challenge_id and x.user_id = p_user);
  -- Las partidas ya terminadas cuentan para su racha y estadísticas (los puntos ya se sumaron).
  for v_row in
    update game_sessions gs set user_id = p_user, guest_id = null
    where gs.guest_id = p_guest
      and exists (select 1 from daily_plays dp where dp.session_id = gs.id and dp.user_id = p_user)
    returning gs.id, gs.started_at, gs.status
  loop
    if v_row.status <> 'started' then
      perform _game_credit_user(p_user, v_row.id, v_row.started_at, false);
    end if;
  end loop;

  return v_points;
end $$;

-- Partidas abiertas sin actividad durante 30 min → abandonadas (cuentan como jugadas).
create or replace function public.abandon_stale_sessions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_n int := 0;
begin
  for v_row in
    select gs.id, gs.started_at from game_sessions gs
    where gs.status = 'started'
      and greatest(gs.started_at, coalesce((
            select max(coalesce(sa.answered_at, sa.shown_at)) from session_answers sa
            where sa.session_id = gs.id and sa.session_started = gs.started_at), gs.started_at))
          < now() - interval '30 minutes'
  loop
    perform _game_finish(v_row.id, v_row.started_at, 'abandoned');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Solo el servidor puede ejecutar el motor de partida.
do $$
declare
  f text;
begin
  foreach f in array array[
    'ensure_month_partitions(int)', 'ensure_daily_challenge(date)',
    '_game_owned_session(uuid,uuid,uuid)', '_game_total(bigint)', 'game_resolve_guest(text)',
    'game_start_daily(uuid,uuid)', '_game_options(uuid,bigint,text)',
    'game_next(uuid,uuid,uuid,text)', 'game_submit(uuid,uuid,uuid,int,text,text)',
    '_game_finish(uuid,timestamptz,session_status)',
    '_game_credit_user(uuid,uuid,timestamptz,boolean)',
    'game_record_score(uuid,uuid,uuid,int,boolean,int,int)',
    'game_summary(uuid,uuid,uuid)', 'claim_guest(uuid,uuid)', 'abandon_stale_sessions()',
    'handle_new_auth_user()'
  ] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon, authenticated', f);
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6) ROW LEVEL SECURITY EN TODAS LAS TABLAS
--    Sin política = nadie (salvo service_role) puede leer ni escribir.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    return;  -- Postgres sin Supabase (tests): no hay roles de cliente
  end if;

  -- Lectura pública: datos de fútbol y catálogos (sin nada que revele respuestas).
  foreach t in array array[
    'countries', 'teams', 'competitions', 'seasons', 'players', 'player_aliases', 'player_spells',
    'player_season_stats', 'transfers', 'awards', 'award_winners', 'competition_winners',
    'matches', 'match_lineups', 'records', 'question_categories', 'game_modes', 'achievements',
    'divisions', 'season_themes'
  ] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   t || '_public_read', t);
  end loop;

  -- Cada usuario lee solo lo suyo. Las escrituras las hace el servidor.
  create policy users_self_read on public.users for select to authenticated
    using (id = (select auth.uid()));
  create policy user_stats_self_read on public.user_stats for select to authenticated
    using (user_id = (select auth.uid()));
  create policy user_category_stats_self_read on public.user_category_stats for select to authenticated
    using (user_id = (select auth.uid()));
  create policy user_achievements_self_read on public.user_achievements for select to authenticated
    using (user_id = (select auth.uid()));
  create policy user_trophies_self_read on public.user_trophies for select to authenticated
    using (user_id = (select auth.uid()));
  create policy subscriptions_self_read on public.subscriptions for select to authenticated
    using (user_id = (select auth.uid()));
  create policy daily_plays_self_read on public.daily_plays for select to authenticated
    using (user_id = (select auth.uid()));
  create policy game_sessions_self_read on public.game_sessions for select to authenticated
    using (user_id = (select auth.uid()));
  create policy friendships_party_read on public.friendships for select to authenticated
    using ((select auth.uid()) in (requester_id, addressee_id));

  -- question_options, question_accepted_answers, session_answers, guest_sessions y las
  -- tablas de preguntas: SIN políticas a propósito. Solo el servidor las lee.
end $$;

-- ---------------------------------------------------------------------
-- 7) TAREAS PROGRAMADAS (pg_cron, si está disponible)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('ctv-particiones', '0 3 * * *', 'select public.ensure_month_partitions(2)');
    perform cron.schedule('ctv-reto-diario', '5 22 * * *',
      $job$select public.ensure_daily_challenge(public.game_today() + 1)$job$);
    perform cron.schedule('ctv-abandonadas', '*/10 * * * *', 'select public.abandon_stale_sessions()');
  end if;
end $$;
