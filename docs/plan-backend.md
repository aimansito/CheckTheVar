# Plan de backend y base de datos

Skills de referencia: `base-de-datos`, `flujo-juego-antitrampas`, `crear-preguntas`.

## Estado (09/11/2026)

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

### Cómo se ha probado
- `pnpm test`: 23 tests de puntuación y validaciones.
- `pnpm --filter web test:e2e`: 14 comprobaciones de la API contra Supabase local. Cubre no
  reiniciar el reto, no filtrar la respuesta, recargar sin reiniciar el reloj, pregunta no
  mostrada, opción inválida, doble respuesta, acceso a una partida ajena e invitado jugando dos veces.
- Recorrido completo en navegador (móvil): un invitado juega 8 preguntas, se registra desde el
  resumen y los puntos y la racha aparecen en el perfil.
- Seguridad con la clave pública: `question_options` y `session_answers` devuelven vacío y las
  funciones `game_*` devuelven 401.

## Cómo levantarlo en local
```bash
pnpm db:start            # Supabase local (Docker). Usa -x para no levantar servicios que no hacen falta
pnpm db:reset            # migraciones + seed
# crea apps/web/.env.local con: pnpm exec supabase status -o env  (ver README)
pnpm --filter web dev
pnpm --filter web test:e2e http://localhost:3000
```

## Pendiente (por prioridad)
1. **Desplegar**: proyecto de Supabase en Frankfurt (`supabase link` + `db push`, y el seed a mano)
   y la web en Vercel con las 3 variables de entorno.
2. **Más preguntas verificadas**: ahora hay 8 y el reto pide 10. Usa la skill `crear-preguntas`.
3. **Rate limit** en `start` y `answer` con Upstash Redis. Aviso de respuestas en menos de 400 ms
   repetidas.
4. **Login con Google y Apple**, y recuperar contraseña.
5. **Textos legales reales** (las páginas actuales son provisionales) y banner de cookies cuando
   haya analítica o anuncios.
6. **Más modos de juego**: `higher-lower` y `survival` reutilizan casi todo el motor.
7. **Ligas** (skill `ligas-temporadas`).
8. Ranking en vivo con Redis y vitrina de trofeos en el perfil.

## Decisiones de diseño
- **Puntos calculados en Node, no en SQL.** CLAUDE.md exige que los valores vivan en
  `scoring.ts`. El SQL corrige y guarda `answered_at`; el servidor calcula los puntos y los
  guarda con `game_record_score`, que es idempotente.
- **Opciones barajadas por sesión** con `md5(session_id || option_id)`. El cliente solo ve letras
  (A/B/C), así que ni el orden ni los ids revelan la respuesta.
- **Fecha del reto en horario de España** (`game_today()`).
- **Tiempo agotado**: el cliente envía `{ timeout: true }` y cuenta como fallo, aunque hubiera una
  opción marcada sin pulsar CHECK THE VAR.
