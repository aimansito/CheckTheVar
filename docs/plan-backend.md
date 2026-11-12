# Plan de backend y base de datos

Skills de referencia: `base-de-datos`, `flujo-juego-antitrampas`, `crear-preguntas`.

## Estado (11/11/2026)

### ✅ Hecho
- **Esquema inicial** (`20261103000000_esquema_inicial.sql`), con 51 tablas.
- **Correcciones y motor de partida** (`20261109000000_correcciones_y_reto_diario.sql`):
  - Particiones mensuales con `ensure_month_partitions()`, más partición `default` de reserva.
  - Tabla `daily_plays`: un reto diario por jugador. El índice antiguo no impedía nada.
  - `users.id` enlazado a `auth.users`, con un trigger que crea el perfil y `user_stats` al registrarse.
  - **RLS en todas las tablas**: lectura pública de catálogos, cada usuario solo lee lo suyo, y
    `question_options`, `session_answers` y `guest_sessions` sin acceso desde el cliente.
  - Motor de partida en funciones SQL que solo puede ejecutar `service_role`: `game_start_daily`,
    `game_next`, `game_submit`, `game_record_score`, `game_summary`, `claim_guest` y
    `abandon_stale_sessions`.
  - Jobs de pg_cron: crear particiones, preparar el reto de mañana y marcar partidas abandonadas.
- **API** (`apps/web/app/api/game/`): `start`, `[id]/next`, `[id]/answer` y `[id]/summary`.
  Validan con zod (`@checkthevar/shared`) y puntúan con `scoreAnswer()`. Los valores de
  puntuación solo están en `scoring.ts`.
- **Invitados**: cookie técnica `ctv_guest` creada en `proxy.ts`. En la BD solo se guarda su hash.
- **Registro, acceso y perfil**: Supabase Auth con email y contraseña. Al registrarse o entrar,
  los puntos y la partida de hoy del invitado pasan a la cuenta, incluida la racha.
- **Interfaz**: landing, reto diario jugable (CHECK THE VAR → "Revisando la jugada…" →
  GOL CONFIRMADO o GOL ANULADO → resumen), registro, acceso, perfil y páginas legales provisionales.

- **Datos de fútbol** (`20261110000000_datos_futbol_importables.sql` + `packages/datos`): lotes JSON
  en `docs/datos/` con el formato de `plantilla-datos.json`. El importador valida con zod, comprueba
  que todos los refs existan y hace upsert por `slug` o clave natural, así que se puede repetir.
  Cada fila guarda su `source_url`. Fechas parciales: `start_year`/`end_year` y `transfer_year`
  cuando la fuente solo da el año. Países con subdivisión (`GB-ENG`, `GB-SCT`…).
  Cargado (10/11/2026, lotes 1-7): 339 jugadores, 580 etapas, 274 equipos, campeones de Mundial,
  Eurocopa y Champions, 298 premiados (Balón de Oro, FIFA World Player, The Best, Bota de Oro),
  74 fichajes, 13 récords, 36 jugadores que pasaron por Barça y Madrid, 126 goles de las 40 finales
  de Mundial y Eurocopa (minuto y asistente) y 123 alias.
- **Goles y herencia** (`20261110010000_goles_y_herencia_selecciones.sql`): tabla `match_goals` y
  `teams.successor_team_id` (RFA → Alemania, Checoslovaquia → República Checa). Para contar títulos
  de una selección, suma los de sus predecesoras: `coalesce(successor_team_id, id)`.
- **Todos los modos de juego** (`20261111000000_modos_de_juego.sql`): `game_start` genérico,
  `game_next` que sirve de la bolsa del modo (`questions.kind`: quiz, higher_lower, guess_player,
  career_path), `game_clue` (pistas), texto libre contra `question_accepted_answers` (exacto o con
  una errata, `levenshtein`), `game_abandon`, fin por tiempo (`ends_at`) y `user_mode_stats`
  (mejor marca por modo). Las reglas de cada modo (preguntas, tiempo, fin al fallar, pistas) están
  solo en `MODE_RULES` de `scoring.ts`; el servidor se las pasa a la BD al empezar.
  Jugables: reto diario, supervivencia, contrarreloj (90 s), más o menos (fichajes), adivina el
  jugador y trayectoria (pistas + bonus por pistas no usadas). Grid queda pendiente.
- **Generador de preguntas** (`packages/datos/src/preguntas.ts`, skill `crear-preguntas`): 14
  plantillas sobre campeones, finales (resultado, goleador, primer gol), premios, fichajes,
  jugadores de dos clubes, nacionalidad, récords y pistas. 1.362 preguntas con la carga actual,
  cada una con `source_url`, `generator_key` + `generator_ref` (idempotente) y `question_entities`.
- **Acceso seguro**: login con Google/Apple (PKCE, `/auth/callback`), recuperar y cambiar
  contraseña (`/recuperar`, `/nueva-contrasena`, `/perfil/seguridad`), límite de peticiones en
  `start`, `answer`, `clue` y en registro/acceso/recuperación (`lib/rate-limit.ts`: Upstash o
  memoria), cabeceras de seguridad, redirecciones solo internas y marca de cuentas con 5
  respuestas en menos de 400 ms (`users.flagged_at`).

- **Niveles de dificultad y ligas** (`20261112000000_dificultad_y_ligas.sql`):
  - 5 niveles (Normal, Aficionado, Estrella, Leyenda, Histórico) con rangos de dificultad que se
    solapan y multiplicador de puntos (`DIFFICULTY_LEVELS` en `scoring.ts`). Se elige al
    registrarse (`users.difficulty`) y antes de cada partida (`game_sessions.difficulty_*`).
    El reto diario no tiene nivel: es igual para todos.
  - La dificultad de las preguntas generadas se calcula por época + fama del protagonista.
  - Ligas privadas: `league_create/join/leave/list/view`, código de 6 caracteres sin letras
    ambiguas, 10 jornadas semanales (cierran el lunes 00:00 de España), temática rotativa por
    categoría, mismas 10 preguntas para todos (`matchday_questions`), una partida por jornada
    (`matchday_plays`), 1 contra 1 por el método del círculo, quien no juega pierde,
    clasificación, campeón + máximo acertante en `user_trophies` y temporada siguiente.
    `league_tick` pone al día cada liga al verla y cada 10 min con pg_cron.
  - Pendiente de ligas: copa a mitad de temporada, ligas públicas con divisiones, avisos.

### Cómo se ha probado
- `pnpm test`: 30 tests de puntuación (incluidas pistas y reglas por modo), validaciones y lotes.
- `pnpm --filter web test:e2e`: 14 comprobaciones de la API contra Supabase local. Cubre no
  reiniciar el reto, no filtrar la respuesta, recargar sin reiniciar el reloj, pregunta no
  mostrada, opción inválida, doble respuesta, acceso a una partida ajena e invitado jugando dos veces.
- `pnpm --filter web test:e2e:modos`: 27 comprobaciones con un usuario de prueba: supervivencia
  termina al fallar y retoma la partida abierta, más o menos con 2 opciones, contrarreloj con
  reloj global, pistas (pedir, no filtrar, no pedir tras responder), texto libre, abandonar,
  modo no disponible y 429 por límite de peticiones.
- Recorrido en navegador móvil: registro, hub de juegos, supervivencia, adivina el jugador
  (Messi con 2 pistas: +180), más o menos, contrarreloj y perfil con marcas por modo.
- Recorrido completo en navegador (móvil): un invitado juega 8 preguntas, se registra desde el
  resumen y los puntos y la racha aparecen en el perfil.
- Seguridad con la clave pública: `question_options` y `session_answers` devuelven vacío y las
  funciones `game_*` devuelven 401.

## Cómo levantarlo en local
```bash
pnpm db:start            # Supabase local (Docker). Usa -x para no levantar servicios que no hacen falta
pnpm db:reset            # migraciones + seed
# crea apps/web/.env.local con: pnpm exec supabase status -o env  (ver README)
pnpm datos:importar            # todos los docs/datos/lote*.json en orden
pnpm datos:preguntas --publicar  # genera las preguntas desde los datos (en producción: sin --publicar y revisar)
pnpm --filter web dev
pnpm --filter web test:e2e http://localhost:3000
```

## Pendiente (por prioridad)
1. **Desplegar**: proyecto de Supabase en Frankfurt (`supabase link` + `db push`, y el seed a mano)
   y la web en Vercel con las 3 variables de entorno.
2. **Más datos** (ligas nacionales, más trayectorias, entrenadores) y revisión de las preguntas
   generadas antes de publicarlas en la nube (`question_reports` + panel de revisión).
3. **Grid** (nombrar jugador que cumpla fila y columna): validar en servidor contra
   `player_spells`/`players` y búsqueda por alias (índices trigram).
4. **Textos legales reales** (las páginas actuales son provisionales) y banner de cookies cuando
   haya analítica o anuncios. Activar Google/Apple en Supabase Auth y `NEXT_PUBLIC_OAUTH_PROVIDERS`.
5. **Ligas** (skill `ligas-temporadas`).
6. Ranking en vivo con Redis y vitrina de trofeos en el perfil.

## Decisiones de diseño
- **Puntos calculados en Node, no en SQL.** CLAUDE.md exige que los valores vivan en
  `scoring.ts`. El SQL corrige y guarda `answered_at`; el servidor calcula los puntos y los
  guarda con `game_record_score`, que es idempotente.
- **Opciones barajadas por sesión** con `md5(session_id || option_id)`. El cliente solo ve letras
  (A/B/C), así que ni el orden ni los ids revelan la respuesta.
- **Fecha del reto en horario de España** (`game_today()`).
- **Tiempo agotado**: el cliente envía `{ timeout: true }` y cuenta como fallo, aunque hubiera una
  opción marcada sin pulsar CHECK THE VAR.
- **Una partida abierta por modo**: `game_start` retoma la partida `started` de los últimos 30 min.
  Abandonar una pregunta difícil para que salga otra no sirve: hay que responderla o abandonar
  (y la partida cuenta). El reto diario nunca se abandona, se retoma.
- **Texto libre**: el servidor normaliza (`normalizeAnswer`, copiada en `packages/datos`) y acepta
  nombre, nombre completo, alias y apellido; con una errata si la respuesta tiene 6+ letras.
