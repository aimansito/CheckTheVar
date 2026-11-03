---
name: base-de-datos
description: Convenciones de la base de datos PostgreSQL/Supabase de CHECK THE VAR. Úsala al crear o cambiar tablas, índices, políticas RLS, funciones SQL o migraciones.
---

# Base de datos

Fuente de verdad: `supabase/migrations/`. El esquema inicial es
`20261103000000_esquema_inicial.sql`; léelo antes de proponer cambios.

## Bloques
1. Usuarios: `users`, `guest_sessions`, `subscriptions`, `friendships`, `user_stats`,
   `user_category_stats`.
2. Fútbol: `countries`, `teams` (clubes y selecciones), `competitions`, `seasons`, `players`,
   `player_aliases`, `player_spells`, `player_season_stats`, `transfers`, `awards`,
   `award_winners`, `competition_winners`, `matches`, `match_lineups`, `records`.
3. Preguntas: `question_categories`, `questions`, `question_translations`,
   `question_options`, `question_option_translations`, `question_accepted_answers`,
   `question_entities`, `question_stats`.
4. Partidas: `game_modes`, `daily_challenges`, `daily_challenge_questions`,
   `game_sessions` y `session_answers` (particionadas por mes).
5. Ligas: `leagues`, `league_members`, `divisions`, `season_themes`, `league_seasons`,
   `matchdays`, `matchday_questions`, `fixtures`, `matchday_results`, `standings`.
6. Gamificación: `achievements`, `user_achievements`, `user_trophies`.
7. Moderación: `question_reports`, `data_sources`.

## Convenciones
- Tablas y columnas en inglés, `snake_case`, plural para tablas.
- PK: `uuid` para entidades de usuario, `bigserial` para datos de fútbol y contenido.
- `created_at timestamptz default now()` donde tenga sentido.
- Toda FK usada en filtros lleva índice.
- Nunca editar una migración aplicada: crear otra con `npx supabase migration new`.
- Cambios destructivos (drop, rename) en pasos: añadir → migrar datos → eliminar.

## Particiones
`game_sessions` y `session_answers` se particionan por mes. Un job programado
(pg_cron o pg_partman) crea la partición del mes siguiente antes de que empiece.

## RLS (obligatorio)
- RLS activado en toda tabla con datos de usuario.
- Un usuario solo lee/escribe sus filas (`auth.uid() = user_id`).
- `question_options.is_correct` y `question_accepted_answers` sin lectura para clientes:
  solo desde funciones de servidor con la service role.
- Datos de fútbol y preguntas publicadas: lectura pública mediante vistas sin columnas sensibles.

## Rendimiento
- Clasificaciones precalculadas en `standings` al cerrar jornada.
- Rankings en vivo en Redis (sorted sets), no con `ORDER BY` sobre partidas.
- Búsqueda de jugadores: índices trigram en `players.known_as` y `player_aliases.alias`, con `unaccent`.
