-- =====================================================================
--  Límite de partidas al día por juego
--  - Cada juego (salvo reto diario y jornadas de liga) se puede jugar N veces al día; N lo
--    decide MODE_RULES.playsPerDay en packages/shared/src/scoring.ts.
--  - De las partidas del día en un mismo juego, a los puntos totales solo suma la mejor.
-- =====================================================================

drop function if exists public.game_start(uuid, uuid, text, text, int, int, text, int, int, boolean);

create or replace function public.game_start(
  p_user uuid, p_guest uuid, p_mode text, p_kind text, p_total int, p_duration_ms int,
  p_level text, p_min int, p_max int, p_old boolean, p_plays_per_day int)
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

  -- Límite de partidas al día por modo (las abandonadas también cuentan).
  if p_plays_per_day is not null and p_user is not null and (
       select count(*) from game_sessions
       where user_id = p_user and game_mode_id = v_mode.id
         and started_at >= (game_today()::timestamp at time zone 'Europe/Madrid')
     ) >= p_plays_per_day then
    raise exception 'daily_limit';
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

create or replace function public._game_finish(p_session uuid, p_started timestamptz, p_status session_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_best_streak int;
  v_prev_best int;
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

  -- Modos con límite diario: de las partidas de hoy en el mismo modo solo suma la mejor.
  -- Se descuenta lo que ya sumó la mejor anterior (si esta es peor, en total suma 0).
  if v_s.challenge_id is null and v_s.matchday_id is null then
    select max(score) into v_prev_best from game_sessions
    where user_id = v_s.user_id and game_mode_id = v_s.game_mode_id
      and id <> v_s.id and status <> 'started'
      and started_at >= (game_today()::timestamp at time zone 'Europe/Madrid');
    if coalesce(v_prev_best, 0) > 0 and v_s.score > 0 then
      update user_stats
      set total_points = total_points - least(v_s.score, v_prev_best),
          xp           = xp - least(v_s.score, v_prev_best)
      where user_id = v_s.user_id;
    end if;
  end if;

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

revoke execute on function public.game_start(uuid, uuid, text, text, int, int, text, int, int, boolean, int) from public, anon, authenticated;
grant execute on function public.game_start(uuid, uuid, text, text, int, int, text, int, int, boolean, int) to service_role;
revoke execute on function public._game_finish(uuid, timestamptz, session_status) from public, anon, authenticated;
