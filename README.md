# CHECK THE VAR

Plataforma de quiz y juegos de fútbol: respondes, pulsas **CHECK THE VAR** y descubres si es
**GOL CONFIRMADO** o **GOL ANULADO**. Las reglas del proyecto están en
[.claude/CLAUDE.md](.claude/CLAUDE.md).

## Estructura

```
apps/web        Next.js 16 (App Router, Tailwind 4): web + futuras rutas API
apps/video      Remotion: vídeos de quiz para TikTok
packages/shared Puntuación, tipos y validaciones (zod) compartidos con el servidor
supabase/       Migraciones (fuente de verdad de la BD) y seed de desarrollo
docs/           Guías (vídeos, plan de backend)
```

## Puesta en marcha (en cualquier ordenador)

Requisitos: **Node 20+**, **Git** y **pnpm** (`npm i -g pnpm`). Docker solo si quieres
Supabase en local.

```bash
git clone https://github.com/aimansito/CheckTheVar.git
cd CheckTheVar
pnpm install
pnpm test            # tests de puntuación y validaciones
pnpm --filter web dev  # http://localhost:3000
```

### Variables de entorno
Crea `apps/web/.env.local` (no se sube a Git) con:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...        # solo servidor; nunca en componentes de cliente
```

Los valores salen de Supabase → *Project Settings → API Keys*. En local, salen de
`pnpm exec supabase status -o env` (`API_URL`, `PUBLISHABLE_KEY` y `SECRET_KEY`).

### Base de datos
- **Local (con Docker):** `pnpm db:start` y `pnpm db:reset` (aplica migraciones + `supabase/seed.sql`).
- **Nube (sin Docker, p. ej. en clase):** ver [docs/plan-backend.md](docs/plan-backend.md#1-conectar-supabase).

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Arranca todas las apps |
| `pnpm --filter web dev` | Solo la web |
| `pnpm test` | Tests (Vitest) |
| `pnpm --filter web test:e2e [url]` | Prueba de integración del reto diario (con Supabase local y la web arrancadas) |
| `pnpm typecheck` / `pnpm lint` | Comprobaciones de tipos y estilo |
| `pnpm db:new <nombre>` | Nueva migración en `supabase/migrations/` |
| `pnpm db:reset` | Reaplica migraciones y seed en local |
| `pnpm db:types` | Genera tipos TS de la BD en `packages/shared` |
| `pnpm --filter video studio` | Editor visual de los vídeos |
| `pnpm --filter video render` | Renderiza los vídeos de `apps/video/data/lote.json` |
