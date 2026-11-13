-- =====================================================================
--  Modo Retro y variedad de preguntas
--  - "Retro": preguntas de antes de 1995 (finales, goles y premios antiguos). Fuera de ese
--    modo solo salen en el nivel Histórico o si no queda nada más.
--  - Variedad: en cada partida se alternan los tipos de pregunta, para que no salgan
--    seguidas varias de "quién marcó en la final de…".
-- =====================================================================

-- Pregunta "retro": trata de algo ocurrido antes de 1995.
create or replace function public._question_is_retro(p_era_to int)
returns boolean
language sql
immutable
as $$ select coalesce(p_era_to, 9999) < 1995 $$;

-- Familia de una pregunta generada. Las plantillas de finales se agrupan: para el jugador
-- son "el mismo tipo" de pregunta.
create or replace function public._question_family(p_key text)
returns text
language sql
immutable
as $$
  select case
    when p_key in ('final_score', 'final_scorer', 'first_scorer', 'competition_runner_up', 'competition_champion') then 'finals'
    else coalesce(p_key, 'manual')
  end
$$;

-- Nuevo modo (con cuenta).
insert into public.game_modes (slug, name_es, requires_account) values ('retro', 'Retro', true)
on conflict (slug) do nothing;

-- Elección de la siguiente pregunta de una partida.
-- p_kind = 'retro' → preguntas tipo test de antes de 1995.
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
  where q.status = 'published'
    and q.kind = case when p_kind = 'retro' then 'quiz' else p_kind end
    and (p_kind <> 'retro' or _question_is_retro(q.era_to))
    and not exists (
      select 1 from session_answers sa
      where sa.session_id = p_session and sa.session_started = p_started and sa.question_id = q.id)
  order by
    -- 1) Fuera de Retro, lo antiguo solo en nivel Histórico o si no queda otra cosa.
    (p_kind <> 'retro' and not coalesce(p_old, false) and _question_is_retro(q.era_to)),
    -- 2) Dentro del rango de dificultad del nivel.
    case when q.difficulty between coalesce(p_min, 1) and coalesce(p_max, 5) then 0
         else least(abs(q.difficulty - coalesce(p_min, 1)), abs(q.difficulty - coalesce(p_max, 5))) end,
    -- 3) Variedad: primero el tipo de pregunta que menos ha salido en esta partida.
    (select count(*) from session_answers sa
     join questions q2 on q2.id = sa.question_id
     where sa.session_id = p_session and sa.session_started = p_started
       and _question_family(q2.generator_key) = _question_family(q.generator_key)),
    -- 4) Lo que el jugador no ha visto en la última semana.
    (p_user is not null and exists (
      select 1 from game_sessions gs
      join session_answers sa on sa.session_id = gs.id and sa.session_started = gs.started_at
      where gs.user_id = p_user and gs.started_at > now() - interval '7 days'
        and sa.question_id = q.id)),
    random()
  limit 1
$$;

-- Reto diario: 10 preguntas actuales (desde 1995), como mucho 2 del mismo tipo, sin repetir
-- las de los últimos 30 días y ordenadas de más fácil a más difícil.
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
  select v_id, picked.id, row_number() over (order by picked.difficulty, picked.ord)
  from (
    select c.id, c.difficulty, c.ord
    from (
      select q.id, q.difficulty, random() as ord,
             _question_family(q.generator_key) as family,
             _question_is_retro(q.era_to) as retro,
             exists (
               select 1 from daily_challenge_questions dcq
               join daily_challenges dc on dc.id = dcq.challenge_id
               where dcq.question_id = q.id and dc.challenge_date > p_date - 30
             ) as recent
      from questions q
      where q.status = 'published' and q.format = 'multiple_choice'
    ) c
    order by c.retro, c.recent,
             (row_number() over (partition by c.family order by c.retro, c.recent, c.ord)) > 2,
             c.ord
    limit 10
  ) picked;

  return v_id;
end $$;

-- Jornadas de liga: igual que antes, sin preguntas antiguas (salvo nivel Histórico) y con
-- como mucho 3 preguntas del mismo tipo.
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
  select p_md, picked.id, row_number() over (order by picked.difficulty, picked.ord)
  from (
    select c.id, c.difficulty, c.ord
    from (
      select q.id, q.difficulty,
             -- Lo antiguo (antes de 1995) solo en ligas de nivel Histórico o si no queda otra.
             (case when not v_league.difficulty_old and _question_is_retro(q.era_to) then 100 else 0 end)
             + (case when v_cat is null or q.category_id = v_cat then 0 else 1 end) * 10
             + case when q.difficulty between v_league.difficulty_min and v_league.difficulty_max then 0
                    else 5 + least(abs(q.difficulty - v_league.difficulty_min), abs(q.difficulty - v_league.difficulty_max)) end
             + random() as ord,
             _question_family(q.generator_key) as family
      from questions q
      where q.status = 'published' and q.kind = 'quiz' and q.format = 'multiple_choice'
        and not exists (
          select 1 from matchday_questions mq
          join matchdays m on m.id = mq.matchday_id
          join league_seasons s on s.id = m.league_season_id
          where s.league_id = v_league.id and mq.question_id = q.id)
    ) c
    -- Variedad: como mucho 3 preguntas del mismo tipo por jornada (si hay de dónde elegir).
    order by (row_number() over (partition by c.family order by c.ord)) > 3, c.ord
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

-- Permisos: estas funciones internas solo las usa el servidor.
revoke execute on function public._game_pick_question(uuid, timestamptz, uuid, text, int, int, boolean) from public, anon, authenticated;
revoke execute on function public._league_open_matchday(bigint) from public, anon, authenticated;
revoke execute on function public.ensure_daily_challenge(date) from public, anon, authenticated;
revoke execute on function public._question_is_retro(int) from public, anon, authenticated;
revoke execute on function public._question_family(text) from public, anon, authenticated;
