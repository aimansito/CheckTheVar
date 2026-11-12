-- =====================================================================
-- Goles de partidos (minuto, asistente) y herencia de selecciones históricas.
-- =====================================================================

-- Goles de un partido. Sin goles de tandas de penaltis.
create table match_goals (
  id               bigserial primary key,
  match_id         bigint not null references matches(id) on delete cascade,
  team_id          bigint not null references teams(id),     -- equipo al que se le suma el gol
  player_id        bigint not null references players(id),   -- quien marca (en un autogol, el rival)
  assist_player_id bigint references players(id),            -- solo si la fuente lo dice explícitamente
  minute           smallint not null check (minute between 1 and 130),
  added_time       smallint check (added_time between 1 and 30),
  penalty          boolean not null default false,
  own_goal         boolean not null default false,
  golden_goal      boolean not null default false,
  source_url       text,
  constraint match_goals_natural_key unique nulls not distinct (match_id, minute, added_time, player_id)
);
create index match_goals_match  on match_goals(match_id);
create index match_goals_player on match_goals(player_id);
create index match_goals_assist on match_goals(assist_player_id);

-- Dato de fútbol público, como el resto de catálogos (20261109000000).
alter table match_goals enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    create policy match_goals_public_read on public.match_goals for select to anon, authenticated using (true);
  end if;
end $$;

-- Selección que hereda el historial de otra (la FIFA cuenta los títulos de la RFA como de
-- Alemania). Las preguntas sobre títulos suman los del equipo y los de sus predecesores.
alter table teams add column successor_team_id bigint references teams(id);
alter table teams add constraint teams_successor_not_self check (successor_team_id <> id);
