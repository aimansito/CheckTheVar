# CHECK THE VAR — Instrucciones del proyecto

Plataforma de juegos y quiz de fútbol para público general. El jugador responde, pulsa
**CHECK THE VAR** y descubre si es **GOL CONFIRMADO** (acierto) o **GOL ANULADO** (fallo).
El objetivo es un juego constante, no una moda: retos diarios, rachas y ligas por temporada
entre amigos que dan un motivo para volver cada día.

Idioma del código: inglés (nombres de variables, tablas, funciones).
Idioma de la interfaz y de los textos de usuario: español primero, preparado para i18n
(inglés, portugués y árabe más adelante). Responde al desarrollador en español.

---

## 1. Producto

### Acceso y registro
- **Invitado (sin cuenta):** solo 1 minijuego al día (el reto diario). El resto de juegos se
  ven, pero bloqueados. Al terminar, se muestra su puntuación con el mensaje
  "Regístrate y guarda estos puntos": los puntos quedan en `guest_sessions.pending_points`
  y se traspasan a la cuenta al registrarse.
- **Registrado gratis:** todos los juegos, puntos diarios, rachas, ligas con amigos.
- **Premium (más adelante):** sin anuncios, archivo histórico de retos, ligas grandes,
  estadísticas avanzadas.

### Modos de juego individuales
| Slug | Nombre | Cuenta |
|---|---|---|
| `daily` | Reto diario (10 preguntas, iguales para todos) | No |
| `grid` | Grid: nombra al jugador que cumpla fila + columna | Sí |
| `guess-player` | Adivina el jugador con pistas progresivas | Sí |
| `career-path` | Trayectoria: adivina por la lista de clubes | Sí |
| `higher-lower` | Más o menos: fichajes, goles, récords | Sí |
| `time-attack` | Contrarreloj | Sí |
| `survival` | Supervivencia: hasta el primer fallo | Sí |

### Liga por temporada (modo estrella)
- Ligas privadas (código de invitación) y públicas (con divisiones).
- Temporada de 10–12 semanas, una jornada por semana.
- Jornadas temáticas: Liga, Champions, Mundial, Eurocopa, otras competiciones, historia de
  jugadores, premios individuales, premios colectivos, récords, trayectorias, fichajes.
- Formatos: `points` (todos responden lo mismo y suman) y `head_to_head` (enfrentamiento
  semanal 1 contra 1: victoria 3, empate 1, derrota 0).
- Copa eliminatoria a mitad de temporada.
- Ligas públicas: ascensos y descensos entre divisiones.
- Fin de temporada: campeón, máximo acertante, mejor racha → trofeos permanentes en la
  vitrina del perfil.

### Puntuación (valores iniciales, ajustables en config)
- Acierto: 100 puntos base + bonus por rapidez de hasta 50 (lineal según el tiempo restante).
- Racha: 3 aciertos seguidos = "Hat-trick", +50.
- Fallo o tiempo agotado: 0 puntos.
- Tiempo por pregunta: 20 s por defecto.
- Todos los valores viven en un único módulo de configuración (`packages/shared/src/scoring.ts`),
  nunca repartidos por el código.

---

## 2. Arquitectura

Monorepo con pnpm workspaces + Turborepo:

```
checkthevar/
├── apps/
│   ├── web/          Next.js (App Router, TypeScript, Tailwind) — web + PWA
│   ├── mobile/       Expo / React Native — fase 2
│   └── video/        Remotion — generador de vídeos para TikTok
├── packages/
│   └── shared/       tipos, validaciones (zod), cliente Supabase, scoring
├── supabase/
│   ├── migrations/   esquema versionado (fuente de verdad de la BD)
│   └── functions/    Edge Functions (lógica de juego en servidor)
└── docs/
```

- **Base de datos:** PostgreSQL en Supabase, región UE (Frankfurt) por RGPD.
- **Auth:** Supabase Auth (email, Google, Apple).
- **Rankings en vivo y límites de invitado:** Redis (Upstash).
- **Hosting web:** Vercel.
- **Regla de oro:** la lógica de negocio (corregir respuestas, sumar puntos, cerrar jornadas,
  calcular clasificaciones) vive en el **servidor** (Edge Functions, funciones SQL o rutas API),
  nunca en componentes de UI. Así la web y la futura app móvil reutilizan lo mismo.

---

## 3. Reglas obligatorias

### Seguridad y antitrampas (ver skill `flujo-juego-antitrampas`)
- `question_options.is_correct` y `question_accepted_answers` **nunca** salen al cliente
  antes de que el jugador pulse CHECK THE VAR.
- Las preguntas se sirven una a una desde el servidor; el tiempo lo mide el servidor
  (`shown_at` / `answered_at`).
- La partida se crea con estado `started` al empezar. Si se abandona, cuenta como jugada.
- Row Level Security activado en todas las tablas con datos de usuario.
- Secretos solo en variables de entorno. Nunca leer, imprimir ni commitear `.env*`.
- Validar toda entrada con zod en el servidor.

### Datos y legalidad
- No usar escudos, logos de ligas, fotos de jugadores ni clips de retransmisiones sin licencia.
  Nombres de jugadores y datos estadísticos sí.
- No hacer scraping de webs cuyas condiciones lo prohíban (p. ej. Transfermarkt). Usar APIs
  con licencia o carga manual, y registrar la fuente en `data_sources`.
- Nunca inventar datos futbolísticos. Si un dato no está verificado, la pregunta queda en
  `draft` con nota de revisión.
- RGPD: banner de cookies antes de anuncios o analítica; borrado lógico + anonimización.

### Código
- TypeScript estricto. Sin `any` salvo justificación en comentario.
- Cambios de BD siempre como migración nueva en `supabase/migrations/`
  (nunca editar una migración ya aplicada). Ver skill `base-de-datos`.
- Componentes pequeños; la UI no calcula puntos ni decide aciertos.
- Tests para scoring, cierre de jornada y clasificación.
- Commits en español, en imperativo: "Añade cierre de jornada".

---

## 4. Marca (ver skill `marca-ui`)
- Nombre: **CHECK THE VAR**. Logo principal: "CHECK / THE" en dos líneas (Anton, blanco)
  + monitor con "VAR" en verde dentro.
- Botón de comprobar respuesta: siempre **CHECK THE VAR**, nunca "Comprobar" o "Enviar".
- Resultados: **GOL CONFIRMADO** / **GOL ANULADO**. Revisión: "Revisando la jugada…".

---

## 5. Comandos habituales
```bash
pnpm install
pnpm dev                          # todas las apps
pnpm --filter web dev             # solo la web
npx supabase start                # Supabase local
npx supabase migration new <nombre>
npx supabase db reset             # reaplica migraciones en local
pnpm --filter video render        # renderiza vídeos de TikTok
```

## 6. Skills del proyecto
- `marca-ui` — colores, tipografías, logo, botón CHECK THE VAR, tono de los textos.
- `flujo-juego-antitrampas` — ciclo de vida de una partida en servidor.
- `base-de-datos` — cómo crear migraciones, índices, particiones y RLS.
- `crear-preguntas` — formato, verificación y dificultad de las preguntas.
- `ligas-temporadas` — jornadas, enfrentamientos, clasificación, ascensos.
- `video-tiktok` — generar vídeos de quiz con Remotion.
