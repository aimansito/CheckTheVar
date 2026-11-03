-- =====================================================================
--  CHECK THE VAR — Esquema de base de datos (PostgreSQL 15+ / Supabase)
--  Bloques: 0) Extensiones y tipos · 1) Usuarios · 2) Datos de fútbol
--           3) Preguntas · 4) Partidas · 5) Ligas y temporadas
--           6) Gamificación · 7) Moderación
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) EXTENSIONES Y TIPOS
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- emails/usernames sin distinguir mayúsculas
create extension if not exists pg_trgm;    -- búsqueda difusa de jugadores ("Modric" ~ "Modrić")
create extension if not exists unaccent;   -- búsqueda sin tildes

create type plan_type          as enum ('free', 'premium');
create type team_type          as enum ('club', 'national');
create type competition_type   as enum ('league', 'cup', 'continental_club', 'international', 'friendly', 'other');
create type position_type      as enum ('GK', 'DF', 'MF', 'FW');
create type transfer_type      as enum ('transfer', 'loan', 'loan_return', 'free', 'youth_promotion', 'retirement');
create type award_scope        as enum ('individual', 'team');
create type question_format    as enum ('multiple_choice', 'free_text', 'true_false', 'order', 'image');
create type question_status    as enum ('draft', 'review', 'published', 'retired');
create type question_origin    as enum ('manual', 'generated');
create type session_status     as enum ('started', 'finished', 'abandoned');
create type league_visibility  as enum ('private', 'public');
create type league_format      as enum ('points', 'head_to_head');
create type member_role        as enum ('owner', 'admin', 'member');
create type matchday_status    as enum ('scheduled', 'open', 'closed');
create type friendship_status  as enum ('pending', 'accepted', 'blocked');

-- ---------------------------------------------------------------------
-- 1) USUARIOS
-- ---------------------------------------------------------------------
-- En Supabase, la autenticación vive en auth.users; aquí guardamos el perfil.
create table users (
  id              uuid primary key default gen_random_uuid(),  -- = auth.users.id en Supabase
  username        citext unique not null check (char_length(username) between 3 and 24),
  email           citext unique not null,
  display_name    text,
  avatar_url      text,
  country_code    char(2),
  language        text not null default 'es',
  plan            plan_type not null default 'free',
  favorite_team_id bigint,                    -- FK añadida tras crear teams
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz,
  deleted_at      timestamptz                 -- borrado lógico (RGPD: anonimizar después)
);

-- Invitados sin registro: límite de 1 reto al día.
create table guest_sessions (
  id               uuid primary key default gen_random_uuid(),
  device_token     text unique not null,      -- cookie firmada / id de dispositivo
  last_played_date date,
  pending_points   int not null default 0,    -- puntos "guardables" al registrarse
  converted_user_id uuid references users(id),
  created_at       timestamptz not null default now()
);

create table subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  provider         text not null,             -- stripe / apple / google
  provider_ref     text not null,
  plan             plan_type not null,
  status           text not null,             -- active, canceled, past_due…
  current_period_end timestamptz,
  created_at       timestamptz not null default now(),
  unique (provider, provider_ref)
);

create table friendships (
  requester_id     uuid not null references users(id) on delete cascade,
  addressee_id     uuid not null references users(id) on delete cascade,
  status           friendship_status not null default 'pending',
  created_at       timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- Estadísticas agregadas (se actualizan al cerrar cada partida).
create table user_stats (
  user_id          uuid primary key references users(id) on delete cascade,
  total_points     bigint not null default 0,
  level            int not null default 1,
  xp               bigint not null default 0,
  current_streak   int not null default 0,
  best_streak      int not null default 0,
  games_played     int not null default 0,
  answers_correct  int not null default 0,
  answers_total    int not null default 0,
  last_daily_date  date,
  updated_at       timestamptz not null default now()
);

-- Aciertos por categoría ("80 % en Premier, 40 % en Serie A").
create table user_category_stats (
  user_id          uuid not null references users(id) on delete cascade,
  category_id      int  not null,             -- FK tras crear question_categories
  answers_correct  int not null default 0,
  answers_total    int not null default 0,
  primary key (user_id, category_id)
);

-- ---------------------------------------------------------------------
-- 2) DATOS DE FÚTBOL (el núcleo: de aquí salen las preguntas automáticas)
-- ---------------------------------------------------------------------
create table countries (
  code             char(2) primary key,       -- ISO 3166-1
  name_es          text not null,
  name_en          text not null,
  confederation    text                       -- UEFA, CONMEBOL…
);

create table teams (                          -- clubes y selecciones
  id               bigserial primary key,
  type             team_type not null,
  name             text not null,
  short_name       text,
  country_code     char(2) references countries(code),
  founded_year     int,
  external_ref     text unique                -- id en la API de datos de origen
);
create index teams_name_trgm on teams using gin (name gin_trgm_ops);
alter table users add constraint users_fav_team_fk foreign key (favorite_team_id) references teams(id);

create table competitions (
  id               bigserial primary key,
  name             text not null,             -- "LaLiga", "UEFA Champions League", "Copa Mundial"
  type             competition_type not null,
  country_code     char(2) references countries(code),  -- null si es internacional
  tier             int,                       -- 1 = primera división
  external_ref     text unique
);

create table seasons (
  id               bigserial primary key,
  competition_id   bigint not null references competitions(id),
  label            text not null,             -- "2009-10", "2010"
  start_date       date,
  end_date         date,
  host_country     char(2) references countries(code),  -- para Mundial/Eurocopa
  unique (competition_id, label)
);

create table players (
  id               bigserial primary key,
  full_name        text not null,
  known_as         text not null,             -- "Ronaldinho"
  birth_date       date,
  death_date       date,
  nationality      char(2) references countries(code),
  second_nationality char(2) references countries(code),
  position         position_type,
  height_cm        int,
  foot             text,
  retired          boolean not null default false,
  popularity       int not null default 0,    -- para dificultad: famosos = fácil
  external_ref     text unique
);
create index players_known_trgm on players using gin (known_as gin_trgm_ops);

-- Nombres alternativos para el autocompletado ("CR7", "Kun Agüero").
create table player_aliases (
  player_id        bigint not null references players(id) on delete cascade,
  alias            text not null,
  primary key (player_id, alias)
);
create index player_aliases_trgm on player_aliases using gin (alias gin_trgm_ops);

-- Dónde jugó cada jugador (base de trayectorias, grids y "¿en qué club…?").
create table player_spells (
  id               bigserial primary key,
  player_id        bigint not null references players(id) on delete cascade,
  team_id          bigint not null references teams(id),
  start_date       date,
  end_date         date,                      -- null = actual
  is_loan          boolean not null default false,
  appearances      int,
  goals            int,
  assists          int
);
create index player_spells_player on player_spells(player_id);
create index player_spells_team   on player_spells(team_id);

-- Estadísticas por jugador, equipo y temporada de competición.
create table player_season_stats (
  player_id        bigint not null references players(id) on delete cascade,
  season_id        bigint not null references seasons(id),
  team_id          bigint not null references teams(id),
  appearances      int, goals int, assists int, minutes int,
  primary key (player_id, season_id, team_id)
);

create table transfers (
  id               bigserial primary key,
  player_id        bigint not null references players(id) on delete cascade,
  from_team_id     bigint references teams(id),
  to_team_id       bigint references teams(id),
  transfer_date    date not null,
  type             transfer_type not null,
  fee_amount       numeric(14,2),             -- null = no revelado
  fee_currency     char(3) default 'EUR',
  fee_is_estimate  boolean not null default true
);
create index transfers_player on transfers(player_id);
create index transfers_fee    on transfers(fee_amount desc nulls last);

-- Premios individuales y colectivos (Balón de Oro, Bota de Oro, mejor portero…).
create table awards (
  id               bigserial primary key,
  name             text not null,
  scope            award_scope not null,
  organizer        text,
  competition_id   bigint references competitions(id)
);

create table award_winners (
  id               bigserial primary key,
  award_id         bigint not null references awards(id),
  year_label       text not null,             -- "2010" o "2009-10"
  player_id        bigint references players(id),
  team_id          bigint references teams(id),
  rank             int not null default 1,    -- 1 ganador, 2-3 podio
  check (player_id is not null or team_id is not null)
);

-- Títulos colectivos: quién ganó cada competición en cada temporada.
create table competition_winners (
  season_id        bigint not null references seasons(id),
  team_id          bigint not null references teams(id),
  final_rank       int not null default 1,    -- 1 campeón, 2 subcampeón
  primary key (season_id, team_id)
);

-- Partidos destacados (finales, clásicos históricos) para "adivina el once".
create table matches (
  id               bigserial primary key,
  season_id        bigint references seasons(id),
  stage            text,                      -- "Final", "Semifinal"
  match_date       date not null,
  home_team_id     bigint not null references teams(id),
  away_team_id     bigint not null references teams(id),
  home_goals       int, away_goals int,
  extra_time       boolean default false,
  penalties        text,                      -- "4-3"
  venue            text
);

create table match_lineups (
  match_id         bigint not null references matches(id) on delete cascade,
  team_id          bigint not null references teams(id),
  player_id        bigint not null references players(id),
  is_starter       boolean not null,
  shirt_number     int,
  position_label   text,
  goals            int default 0,
  primary key (match_id, player_id)
);

-- Récords ("más goles en una temporada de LaLiga").
create table records (
  id               bigserial primary key,
  title            text not null,
  description      text,
  value_numeric    numeric,
  value_text       text,
  player_id        bigint references players(id),
  team_id          bigint references teams(id),
  competition_id   bigint references competitions(id),
  achieved_on      date,
  still_standing   boolean not null default true,
  source_url       text
);

-- ---------------------------------------------------------------------
-- 3) PREGUNTAS
-- ---------------------------------------------------------------------
create table question_categories (            -- árbol: Competiciones > Champions
  id               serial primary key,
  parent_id        int references question_categories(id),
  slug             text unique not null,      -- 'champions', 'fichajes', 'premios-individuales'
  name_es          text not null,
  name_en          text not null
);
alter table user_category_stats add constraint ucs_cat_fk foreign key (category_id) references question_categories(id);

create table questions (
  id               bigserial primary key,
  format           question_format not null default 'multiple_choice',
  category_id      int not null references question_categories(id),
  competition_id   bigint references competitions(id),
  era_from         int, era_to int,           -- años que abarca
  difficulty       smallint not null default 2 check (difficulty between 1 and 5),
  status           question_status not null default 'draft',
  origin           question_origin not null default 'manual',
  generator_key    text,                      -- plantilla que la generó
  media_url        text,
  created_by       uuid references users(id),
  created_at       timestamptz not null default now(),
  verified_at      timestamptz                -- última vez que se comprobó el dato
);
create index questions_pick on questions(status, category_id, difficulty);

-- Textos por idioma (enunciado y explicación tras el VAR).
create table question_translations (
  question_id      bigint not null references questions(id) on delete cascade,
  language         text not null,
  prompt           text not null,
  explanation      text,                      -- "Dato curioso" al revelar
  primary key (question_id, language)
);

create table question_options (
  id               bigserial primary key,
  question_id      bigint not null references questions(id) on delete cascade,
  position         smallint not null,
  is_correct       boolean not null default false,  -- NUNCA se envía al cliente antes del VAR
  player_id        bigint references players(id),   -- si la opción es una entidad
  team_id          bigint references teams(id)
);

create table question_option_translations (
  option_id        bigint not null references question_options(id) on delete cascade,
  language         text not null,
  label            text not null,
  primary key (option_id, language)
);

-- Para preguntas de texto libre: respuestas aceptadas.
create table question_accepted_answers (
  question_id      bigint not null references questions(id) on delete cascade,
  answer_norm      text not null,             -- normalizada: minúsculas, sin tildes
  primary key (question_id, answer_norm)
);

-- Qué entidades menciona cada pregunta (para revisar si cambia un dato).
create table question_entities (
  question_id      bigint not null references questions(id) on delete cascade,
  player_id        bigint references players(id),
  team_id          bigint references teams(id),
  competition_id   bigint references competitions(id)
);
create index question_entities_player on question_entities(player_id);

-- Calibración real de dificultad según los aciertos de los usuarios.
create table question_stats (
  question_id      bigint primary key references questions(id) on delete cascade,
  times_shown      int not null default 0,
  times_correct    int not null default 0,
  avg_time_ms      int
);

-- ---------------------------------------------------------------------
-- 4) MODOS DE JUEGO Y PARTIDAS
-- ---------------------------------------------------------------------
create table game_modes (
  id               serial primary key,
  slug             text unique not null,      -- 'daily', 'grid', 'guess-player', 'career-path', 'higher-lower'
  name_es          text not null,
  requires_account boolean not null default true,
  requires_premium boolean not null default false,
  is_active        boolean not null default true
);

-- Reto diario: igual para todos.
create table daily_challenges (
  id               bigserial primary key,
  game_mode_id     int not null references game_modes(id),
  challenge_date   date not null,
  payload          jsonb,                     -- p. ej. definición del grid
  unique (game_mode_id, challenge_date)
);

create table daily_challenge_questions (
  challenge_id     bigint not null references daily_challenges(id) on delete cascade,
  question_id      bigint not null references questions(id),
  position         smallint not null,
  primary key (challenge_id, position)
);

-- Cada partida. Se crea al EMPEZAR (antitrampas: cerrar la app no la reinicia).
-- Particionada por mes para escalar.
create table game_sessions (
  id               uuid not null default gen_random_uuid(),
  started_at       timestamptz not null default now(),   -- hora del servidor
  user_id          uuid references users(id),
  guest_id         uuid references guest_sessions(id),
  game_mode_id     int not null references game_modes(id),
  challenge_id     bigint references daily_challenges(id),
  matchday_id      bigint,                    -- si es partida de liga
  status           session_status not null default 'started',
  finished_at      timestamptz,
  score            int not null default 0,
  correct_count    smallint not null default 0,
  primary key (id, started_at),
  check (user_id is not null or guest_id is not null)
) partition by range (started_at);

create table game_sessions_2026_11 partition of game_sessions
  for values from ('2026-11-01') to ('2026-12-01');
-- (crear particiones mensuales con un job, p. ej. pg_partman o un cron)

create index game_sessions_user on game_sessions(user_id, started_at desc);
-- Un usuario solo puede jugar una vez cada reto diario:
create unique index one_play_per_challenge
  on game_sessions(user_id, challenge_id, started_at)
  where challenge_id is not null and user_id is not null;

-- Cada respuesta, con tiempo medido en servidor.
create table session_answers (
  session_id       uuid not null,
  session_started  timestamptz not null,
  question_id      bigint not null references questions(id),
  position         smallint not null,
  shown_at         timestamptz not null,      -- servidor envía la pregunta
  answered_at      timestamptz,               -- servidor recibe "Check the VAR"
  option_id        bigint references question_options(id),
  answer_text      text,
  is_correct       boolean,
  points           int not null default 0,
  primary key (session_id, position, session_started),
  foreign key (session_id, session_started) references game_sessions(id, started_at)
) partition by range (session_started);

create table session_answers_2026_11 partition of session_answers
  for values from ('2026-11-01') to ('2026-12-01');

-- ---------------------------------------------------------------------
-- 5) LIGAS Y TEMPORADAS
-- ---------------------------------------------------------------------
create table leagues (
  id               bigserial primary key,
  name             text not null,
  owner_id         uuid not null references users(id),
  visibility       league_visibility not null default 'private',
  format           league_format not null default 'points',
  invite_code      text unique not null,
  max_members      int not null default 20,
  created_at       timestamptz not null default now()
);

create table league_members (
  league_id        bigint not null references leagues(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  role             member_role not null default 'member',
  joined_at        timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- Divisiones para ligas públicas (ascensos y descensos).
create table divisions (
  id               serial primary key,
  name             text not null,             -- "Primera", "Segunda"…
  tier             int not null unique,
  promote_count    int not null default 3,
  relegate_count   int not null default 3
);

-- Temática de cada temporada.
create table season_themes (
  id               serial primary key,
  slug             text unique not null,
  name_es          text not null
);

create table league_seasons (
  id               bigserial primary key,
  league_id        bigint references leagues(id) on delete cascade,  -- null = liga pública global
  division_id      int references divisions(id),
  theme_id         int references season_themes(id),
  number           int not null,              -- temporada 1, 2, 3…
  starts_on        date not null,
  ends_on          date not null,
  champion_user_id uuid references users(id)
);

-- Jornadas temáticas: "miércoles de Champions", "jornada Mundial"…
create table matchdays (
  id               bigserial primary key,
  league_season_id bigint not null references league_seasons(id) on delete cascade,
  number           int not null,
  category_id      int references question_categories(id),
  opens_at         timestamptz not null,
  closes_at        timestamptz not null,
  status           matchday_status not null default 'scheduled',
  is_cup_round     boolean not null default false,
  unique (league_season_id, number)
);

create table matchday_questions (
  matchday_id      bigint not null references matchdays(id) on delete cascade,
  question_id      bigint not null references questions(id),
  position         smallint not null,
  primary key (matchday_id, position)
);

-- Enfrentamientos directos (formato head_to_head y copa).
create table fixtures (
  id               bigserial primary key,
  matchday_id      bigint not null references matchdays(id) on delete cascade,
  home_user_id     uuid not null references users(id),
  away_user_id     uuid references users(id), -- null = descansa
  home_score       int, away_score int,
  winner_user_id   uuid references users(id)
);

-- Resultado de cada usuario en cada jornada.
create table matchday_results (
  matchday_id      bigint not null references matchdays(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  score            int not null default 0,
  correct_count    smallint not null default 0,
  league_points    smallint not null default 0,  -- 3/1/0 en head_to_head
  primary key (matchday_id, user_id)
);

-- Clasificación precalculada al cerrar cada jornada.
create table standings (
  league_season_id bigint not null references league_seasons(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  position         int not null,
  played           int not null default 0,
  won int not null default 0, drawn int not null default 0, lost int not null default 0,
  points           int not null default 0,
  total_score      int not null default 0,
  primary key (league_season_id, user_id)
);

-- ---------------------------------------------------------------------
-- 6) GAMIFICACIÓN (vitrina permanente)
-- ---------------------------------------------------------------------
create table achievements (
  id               serial primary key,
  slug             text unique not null,      -- 'hat-trick', 'racha-30', 'campeon-liga'
  name_es          text not null,
  description_es   text,
  icon             text
);

create table user_achievements (
  user_id          uuid not null references users(id) on delete cascade,
  achievement_id   int not null references achievements(id),
  earned_at        timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table user_trophies (
  id               bigserial primary key,
  user_id          uuid not null references users(id) on delete cascade,
  league_season_id bigint references league_seasons(id),
  title            text not null,             -- "Campeón", "Máximo acertante", "Copa"
  earned_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7) MODERACIÓN Y CALIDAD DE DATOS
-- ---------------------------------------------------------------------
create table question_reports (
  id               bigserial primary key,
  question_id      bigint not null references questions(id) on delete cascade,
  user_id          uuid references users(id),
  reason           text not null,             -- "respuesta incorrecta", "dato desactualizado"
  status           text not null default 'open',
  created_at       timestamptz not null default now()
);

create table data_sources (
  id               serial primary key,
  name             text not null,             -- API con licencia, carga manual…
  license_note     text,
  last_sync_at     timestamptz
);
