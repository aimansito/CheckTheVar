-- =====================================================================
--  Reto diario más sencillo: 5 preguntas de nivel 1 y 5 de nivel 2 (todas desde 1995),
--  como mucho 2 del mismo tipo y sin repetir las de los últimos 30 días.
-- =====================================================================

-- Tipos de pregunta: las de récords y Balones de Oro contados (generadas y manuales) se
-- parecen mucho entre sí, así que cuentan como un solo tipo.
create or replace function public._question_family(p_key text)
returns text
language sql
immutable
as $$
  select case
    when p_key in ('final_score', 'final_scorer', 'first_scorer', 'competition_runner_up', 'competition_champion') then 'finals'
    when p_key is null or p_key in ('record_holder', 'award_count') then 'records'
    else p_key
  end
$$;

create or replace function public.ensure_daily_challenge(p_date date)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode int;
  v_id bigint;
  v_ids bigint[] := '{}';
  v_difs int[] := '{}';
  v_fams text[] := '{}';
  v_q bigint;
  v_d int;
  v_f text;
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

  -- Se eligen una a una para cumplir a la vez dificultad, variedad y no repetir.
  for i in 1..10 loop
    v_q := null;
    select q.id, q.difficulty, _question_family(q.generator_key) into v_q, v_d, v_f
    from questions q
    where q.status = 'published' and q.format = 'multiple_choice' and q.id <> all (v_ids)
    order by
      _question_is_retro(q.era_to),
      -- Nunca repetir las de los últimos 30 días mientras quede alternativa.
      exists (select 1 from daily_challenge_questions dcq
              join daily_challenges dc on dc.id = dcq.challenge_id
              where dcq.question_id = q.id and dc.challenge_date > p_date - 30 and dc.challenge_date < p_date),
      -- Fácil: 5 de nivel 1 y 5 de nivel 2.
      (select count(*) from unnest(v_difs) d where d = q.difficulty)
        >= case q.difficulty when 1 then 5 when 2 then 5 else 0 end,
      -- Variedad: como mucho 2 del mismo tipo (1 de récords, que se parecen mucho).
      (select count(*) from unnest(v_fams) f where f = _question_family(q.generator_key))
        >= case _question_family(q.generator_key) when 'records' then 1 else 2 end,
      q.difficulty,
      random()
    limit 1;
    exit when v_q is null;
    v_ids := v_ids || v_q;
    v_difs := v_difs || v_d;
    v_fams := v_fams || v_f;
  end loop;

  -- De más fácil a más difícil.
  insert into daily_challenge_questions (challenge_id, question_id, position)
  select v_id, x.id, row_number() over (order by x.d, x.n)
  from unnest(v_ids, v_difs) with ordinality as x(id, d, n);

  return v_id;
end $$;

-- Los retos de hoy en adelante que nadie ha empezado se rehacen con las reglas nuevas.
delete from daily_challenges dc
where dc.challenge_date >= game_today()
  and not exists (select 1 from daily_plays dp where dp.challenge_id = dc.id)
  and not exists (select 1 from game_sessions gs where gs.challenge_id = dc.id);

revoke execute on function public.ensure_daily_challenge(date) from public, anon, authenticated;
