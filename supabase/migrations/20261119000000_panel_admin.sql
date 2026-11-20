-- =====================================================================
--  Panel de administración
--  - users.is_admin: quién entra en /admin. Solo se cambia desde SQL (no hay
--    política de UPDATE en users, así que nadie puede darse permisos a sí mismo).
--  - Revisión de preguntas: nota, quién y cuándo.
--  - admin_actions: registro de lo que hace cada admin.
--  - admin_overview(): todas las cifras del resumen en una sola llamada.
--  Todo lo lee y escribe el servidor con la clave secreta (service_role).
-- =====================================================================

alter table public.users add column is_admin boolean not null default false;

alter table public.questions
  add column review_note text,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.users(id);

alter table public.question_reports
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.users(id);
create index question_reports_open on public.question_reports (status, created_at desc);

create table public.admin_actions (
  id          bigserial primary key,
  admin_id    uuid not null references public.users(id),
  action      text not null,              -- 'question.status', 'report.resolve'…
  target      text not null,              -- 'question:123', 'report:45', 'user:<uuid>'
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index admin_actions_recent on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;  -- sin políticas: solo service_role

-- Resumen del panel. Días según la hora de Madrid, como el reto diario.
create or replace function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select (game_today()::timestamp at time zone 'Europe/Madrid') as today_start,
           ((game_today() - 6)::timestamp at time zone 'Europe/Madrid') as week_start,
           ((game_today() - 13)::timestamp at time zone 'Europe/Madrid') as fortnight_start
  ),
  sess as (
    select gs.*, gm.slug from game_sessions gs
    join game_modes gm on gm.id = gs.game_mode_id, bounds b
    where gs.started_at >= b.fortnight_start
  )
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total',   (select count(*) from users where deleted_at is null),
      'today',   (select count(*) from users, bounds b where deleted_at is null and created_at >= b.today_start),
      'week',    (select count(*) from users, bounds b where deleted_at is null and created_at >= b.week_start),
      'flagged', (select count(*) from users where flagged_at is not null and deleted_at is null),
      'admins',  (select count(*) from users where is_admin)
    ),
    'games', jsonb_build_object(
      'today',        (select count(*) from sess, bounds b where started_at >= b.today_start),
      'week',         (select count(*) from sess, bounds b where started_at >= b.week_start),
      'playersToday', (select count(distinct coalesce(user_id::text, guest_id::text)) from sess, bounds b where started_at >= b.today_start),
      'guestsToday',  (select count(distinct guest_id) from sess, bounds b where started_at >= b.today_start and guest_id is not null),
      'abandonedWeek',(select count(*) from sess, bounds b where started_at >= b.week_start and status = 'abandoned')
    ),
    'byMode', coalesce((
      select jsonb_agg(jsonb_build_object('slug', slug, 'today', today, 'week', week) order by week desc)
      from (
        select slug,
               count(*) filter (where started_at >= b.today_start) as today,
               count(*) filter (where started_at >= b.week_start) as week
        from sess, bounds b group by slug
      ) m
    ), '[]'::jsonb),
    'daily14', coalesce((
      select jsonb_agg(jsonb_build_object('date', d::date, 'games', coalesce(g.n, 0), 'signups', coalesce(u.n, 0)) order by d)
      from generate_series(game_today() - 13, game_today(), interval '1 day') d
      left join (
        select (started_at at time zone 'Europe/Madrid')::date as day, count(*) as n from sess group by 1
      ) g on g.day = d::date
      left join (
        select (created_at at time zone 'Europe/Madrid')::date as day, count(*) as n
        from users, bounds b where created_at >= b.fortnight_start and deleted_at is null group by 1
      ) u on u.day = d::date
    ), '[]'::jsonb),
    'guests', jsonb_build_object(
      'total',     (select count(*) from guest_sessions),
      'converted', (select count(*) from guest_sessions where converted_user_id is not null)
    ),
    'questions', (
      select jsonb_object_agg(status, n) from (select status::text, count(*) as n from questions group by status) s
    ),
    'reportsOpen', (select count(*) from question_reports where status = 'open'),
    'leagues', jsonb_build_object(
      'total',   (select count(*) from leagues where deleted_at is null),
      'members', (select count(*) from league_members m join leagues l on l.id = m.league_id where l.deleted_at is null)
    )
  )
$$;

-- Lista de preguntas para revisar, con su respuesta, aciertos y reportes abiertos.
create or replace function public.admin_questions(
  p_status text, p_kind text, p_search text, p_order text, p_limit int, p_offset int)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select q.id, q.kind, q.status::text as status, q.difficulty, q.era_from, q.era_to,
           q.generator_key, q.review_note, q.reviewed_at, q.created_at,
           t.prompt,
           coalesce(
             (select ot.label from question_options o
              join question_option_translations ot on ot.option_id = o.id and ot.language = 'es'
              where o.question_id = q.id and o.is_correct limit 1),
             (select a.answer_norm from question_accepted_answers a where a.question_id = q.id order by length(a.answer_norm) desc limit 1)
           ) as answer,
           coalesce(s.times_shown, 0) as shown,
           coalesce(s.times_correct, 0) as correct,
           (select count(*) from question_reports r where r.question_id = q.id and r.status = 'open') as reports
    from questions q
    left join question_translations t on t.question_id = q.id and t.language = 'es'
    left join question_stats s on s.question_id = q.id
    where (p_status is null or q.status::text = p_status)
      and (p_kind is null or q.kind = p_kind)
      and (p_search is null or t.prompt ilike '%' || p_search || '%' or q.id::text = p_search)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r)) from (
        select * from base
        order by
          case when p_order = 'reportadas' then reports end desc nulls last,
          case when p_order = 'dificiles' and shown >= 5 then correct::numeric / shown end asc nulls last,
          case when p_order = 'faciles' and shown >= 5 then correct::numeric / shown end desc nulls last,
          created_at desc, id desc
        limit p_limit offset p_offset
      ) r
    ), '[]'::jsonb)
  )
$$;

-- Reto diario de un día: preguntas con su respuesta y cuántos la acertaron en ese reto.
create or replace function public.admin_daily_challenge(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ch as (
    select dc.id from daily_challenges dc join game_modes gm on gm.id = dc.game_mode_id
    where gm.slug = 'daily' and dc.challenge_date = p_date
  ),
  answers as (
    select sa.question_id, sa.is_correct
    from game_sessions gs
    join session_answers sa on sa.session_id = gs.id and sa.session_started = gs.started_at
    where gs.challenge_id = (select id from ch)
      and gs.started_at >= (p_date::timestamp at time zone 'Europe/Madrid') - interval '1 day'
      and sa.answered_at is not null
  )
  select case when (select id from ch) is null then null else jsonb_build_object(
    'id', (select id from ch),
    'plays', (select count(*) from daily_plays where challenge_id = (select id from ch)),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', dq.position, 'id', q.id, 'difficulty', q.difficulty, 'prompt', t.prompt,
        'answer', (select ot.label from question_options o
                   join question_option_translations ot on ot.option_id = o.id and ot.language = 'es'
                   where o.question_id = q.id and o.is_correct limit 1),
        'answered', (select count(*) from answers a where a.question_id = q.id),
        'correct', (select count(*) from answers a where a.question_id = q.id and a.is_correct)
      ) order by dq.position)
      from daily_challenge_questions dq
      join questions q on q.id = dq.question_id
      left join question_translations t on t.question_id = q.id and t.language = 'es'
      where dq.challenge_id = (select id from ch)
    ), '[]'::jsonb)
  ) end
$$;

revoke execute on function public.admin_overview() from public;
revoke execute on function public.admin_questions(text, text, text, text, int, int) from public;
revoke execute on function public.admin_daily_challenge(date) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.admin_overview() from anon, authenticated;
    revoke execute on function public.admin_questions(text, text, text, text, int, int) from anon, authenticated;
    revoke execute on function public.admin_daily_challenge(date) from anon, authenticated;
    grant execute on function public.admin_overview() to service_role;
    grant execute on function public.admin_questions(text, text, text, text, int, int) to service_role;
    grant execute on function public.admin_daily_challenge(date) to service_role;
  end if;
end $$;

-- Para hacer admin a alguien (en el editor SQL de Supabase):
--   update public.users set is_admin = true where email = 'tu@correo.com';
