# Plan de backend y base de datos

Objetivo de esta fase: **el reto diario jugable de principio a fin**, con la lógica en el servidor.
Skills que conviene tener a mano: `base-de-datos`, `flujo-juego-antitrampas`, `crear-preguntas`.

## Estado al empezar (03/11/2026)

- ✅ Esquema inicial: `supabase/migrations/20261103000000_esquema_inicial.sql`, con 51 tablas.
  Se ha probado que aplica sin errores sobre PostgreSQL 17.
- ✅ Seed de desarrollo: `supabase/seed.sql`, con los modos de juego, las categorías, 8 preguntas
  verificadas y el reto diario de hoy.
- ✅ `packages/shared`: puntuación (`scoring.ts`), validaciones zod de los endpoints
  (`schemas.ts`) y tipos públicos (`types.ts`), con 16 tests.
- ❌ Falta la conexión de la web con Supabase, la migración de correcciones y los endpoints.

---

## 1. Conectar Supabase

**Opción A: nube (recomendada en clase, no necesita Docker)**
1. Crea un proyecto en supabase.com, en la región **Central EU (Frankfurt)** por el RGPD.
2. En la terminal:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref-del-proyecto>
   pnpm exec supabase db push        # aplica las migraciones
   ```
3. Carga el seed una vez: abre el *SQL Editor* del panel, pega `supabase/seed.sql` y ejecútalo.
4. Crea `apps/web/.env.local` con las claves (ver README).

**Opción B: local (con Docker Desktop arrancado)**
```bash
pnpm db:start     # la primera vez descarga las imágenes y tarda
pnpm db:reset     # aplica las migraciones y el seed
```

> ⚠️ El esquema inicial **todavía no se ha aplicado en ningún proyecto**. Si lo vas a corregir
> antes del primer `db push`, puedes editarlo directamente. Después de aplicarlo, cualquier
> cambio tiene que ir en una migración nueva (`pnpm db:new <nombre>`).

---

## 2. Migración de correcciones (lo primero)

Crear `pnpm db:new correcciones_esquema` con lo siguiente:

### 2.1 🔴 Particiones: a partir del 1 de diciembre se rompe
Solo existe la partición `2026_11`. Comprobado: insertar una partida con fecha
`2026-12-01` da el error *"no partition of relation game_sessions found for row"*.
```sql
create table game_sessions_default   partition of game_sessions   default;
create table session_answers_default partition of session_answers default;
-- y crear 2026_12, 2027_01… con pg_cron (o pg_partman) antes de que empiece cada mes
```

### 2.2 🔴 Se puede jugar dos veces el mismo reto diario
El índice `one_play_per_challenge` incluye `started_at`, porque Postgres lo exige en
tablas particionadas, así que **no impide nada**. Comprobado: se crean 2 partidas del mismo reto
para el mismo usuario. Solución: una tabla no particionada que actúe de "candado":
```sql
create table daily_plays (
  challenge_id bigint not null references daily_challenges(id),
  user_id      uuid references users(id),
  guest_id     uuid references guest_sessions(id),
  session_id   uuid not null,
  created_at   timestamptz not null default now(),
  check (user_id is not null or guest_id is not null)
);
create unique index daily_plays_user  on daily_plays(challenge_id, user_id)  where user_id  is not null;
create unique index daily_plays_guest on daily_plays(challenge_id, guest_id) where guest_id is not null;
drop index one_play_per_challenge;
```

### 2.3 🔴 RLS desactivado en todas las tablas
Es obligatorio según CLAUDE.md. Hay que activar `enable row level security` en todas y luego:
- `users`, `user_stats`, `user_category_stats`, `game_sessions`, `session_answers`,
  `daily_plays`, `user_achievements`, `user_trophies`: el usuario solo lee sus filas
  (`auth.uid() = user_id`). La escritura la hace solo el servidor.
- `question_options`, `question_accepted_answers`: **sin ninguna política** para `anon` ni
  `authenticated`. Solo las lee el servidor con la clave secreta.
- Las preguntas publicadas y los datos de fútbol se leen a través de vistas que no tengan
  `is_correct`.

### 2.4 🟠 Perfil enlazado a Supabase Auth
- `users.id` debería ser `references auth.users(id) on delete cascade`.
- Un trigger `on auth.users insert` que cree la fila en `users` y en `user_stats`.

### 2.5 🟡 Detalles
- `game_sessions.matchday_id` no tiene FK a `matchdays`.
- Añadir índices en las FK que se usan en filtros, por ejemplo `session_answers(question_id)`,
  `daily_challenge_questions(question_id)` y `league_members(user_id)`.

---

## 3. Endpoints del reto diario (rutas API en `apps/web/app/api/`)

Sigue la skill `flujo-juego-antitrampas`. Valida siempre la entrada con los esquemas de
`@checkthevar/shared` y puntúa con `scoreAnswer()`. **No repitas los valores de puntuación.**

| Ruta | Entrada (zod) | Qué hace |
|---|---|---|
| `POST /api/game/start` | `startGameSchema` | Crea `game_sessions` (`started`) + `daily_plays`. Si ya existe, devuelve la existente |
| `GET /api/game/[sessionId]/next` | `sessionParamsSchema` | Devuelve `PublicQuestion` (sin `is_correct`) y guarda `shown_at` |
| `POST /api/game/[sessionId]/answer` | `answerSchema` | Guarda `answered_at`, corrige, puntúa y devuelve `VarVerdict` |

Detalles importantes:
- **Invitados:** una cookie firmada `httpOnly` con un `device_token` → `guest_sessions`. Solo `daily`.
- **Idempotencia:** responder dos veces la misma posición devuelve el primer veredicto.
- **Opciones barajadas por sesión.** No envíes `question_options.id` tal cual: envía un id opaco
  por sesión, para que ni el orden ni el id revelen la respuesta.
- Las consultas que corrigen se hacen con el cliente de servidor y la clave secreta
  (`SUPABASE_SECRET_KEY`), y nunca desde componentes de cliente.
- Lo ideal es que la corrección sea una **función SQL** (`security definer`), por ejemplo
  `submit_answer(session_id, position, option_id)`. Así la app móvil reutiliza exactamente lo mismo.

### Tests mínimos (de la skill)
Respuesta tardía · doble respuesta · reiniciar el reto diario · invitado jugando dos veces ·
bonus por rapidez · hat-trick. Los de puntuación ya están en `packages/shared/src/scoring.test.ts`.

---

## 4. Después
1. Registro con Supabase Auth y traspaso de `guest_sessions.pending_points` al registrarse.
2. Cierre de la partida: actualizar `user_stats`, rachas, `question_stats` y `user_category_stats`.
3. Un job que marque como `abandoned` las sesiones inactivas durante más de 30 minutos.
4. Ranking en vivo con Redis (Upstash).

## Prompt para empezar en clase con Claude Code
```
Lee docs/plan-backend.md y la skill base-de-datos. Crea la migración de correcciones del
apartado 2 (particiones, daily_plays, RLS, enlace con auth.users e índices) y pruébala con
pnpm db:reset.
```
