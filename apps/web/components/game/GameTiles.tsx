import Link from "next/link";
import type { ModeStats } from "@/lib/auth";
import { MODES } from "@/lib/game/modes";

/**
 * Cuadrícula de juegos: miniatura + "JUGAR" + nombre. Se usa en la portada y en /jugar.
 * Solo presenta; las mejores marcas llegan ya calculadas del servidor.
 */
export function GameTiles({ bests, loggedIn, withLeague = true }: { bests: ModeStats | null; loggedIn: boolean; withLeague?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-5">
      {MODES.map((m) => {
        const locked = !m.free && !loggedIn;
        const best = bests?.[m.slug];
        const badge = !m.available ? "Pronto" : m.free ? "Gratis" : locked ? "Con cuenta" : null;
        return (
          <li key={m.slug}>
            <Tile
              href={m.available ? `/jugar/${m.path}` : null}
              name={m.name}
              action={!m.available ? "Próximamente" : locked ? "Crear cuenta" : "Jugar"}
              badge={badge}
              highlight={m.free}
              note={best && best.gamesPlayed > 0 ? `Mejor: ${best.bestScore.toLocaleString("es-ES")}` : null}
            >
              <Thumb slug={m.slug} />
            </Tile>
          </li>
        );
      })}
      {withLeague && (
        <li>
          <Tile href="/ligas" name="Liga con amigos" action="Ver ligas" badge="Temporada" highlight={false} note={null}>
            <LeagueThumb />
          </Tile>
        </li>
      )}
    </ul>
  );
}

function Tile({
  href,
  name,
  action,
  badge,
  highlight,
  note,
  children,
}: {
  href: string | null;
  name: string;
  action: string;
  badge: string | null;
  highlight: boolean;
  note: string | null;
  children: React.ReactNode;
}) {
  const body = (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-surface transition duration-200 ${
        href ? "hover:-translate-y-0.5 hover:border-var" : "border-dashed opacity-55"
      } ${highlight ? "border-var/60" : "border-line"}`}
    >
      {badge && (
        <span
          className={`absolute left-2 top-2 z-10 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
            highlight ? "bg-var text-bg" : "border border-line bg-bg/80 text-muted"
          }`}
        >
          {badge}
        </span>
      )}
      {note && (
        <span className="absolute right-2 top-2 z-10 rounded-md bg-bg/80 px-2 py-0.5 text-[10px] font-bold text-var">{note}</span>
      )}
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-screen px-2 pb-1 pt-7 lg:aspect-[16/9]" aria-hidden>
        <div className="scale-[0.78] transition duration-300 group-hover:scale-[0.82] sm:scale-100 sm:group-hover:scale-[1.04]">{children}</div>
      </div>
      <div className="border-t border-line/60 px-3 py-2.5 text-center">
        <p className={`text-[11px] font-extrabold uppercase tracking-wider ${href ? "text-var" : "text-muted"}`}>{action}</p>
        <p className="font-display text-lg uppercase leading-tight sm:text-xl">{name}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-var">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ---------- Miniaturas: ilustraciones de cada modo, solo con CSS ---------- */

function Thumb({ slug }: { slug: string }) {
  switch (slug) {
    case "daily":
      return <DailyThumb />;
    case "survival":
      return <SurvivalThumb />;
    case "time-attack":
      return <TimeThumb />;
    case "higher-lower":
      return <HigherLowerThumb />;
    case "guess-player":
      return <GuessThumb />;
    case "career-path":
      return <CareerThumb />;
    case "retro":
      return <RetroThumb />;
    default:
      return <GridThumb />;
  }
}

const bar = "h-2.5 rounded-full bg-line";

function DailyThumb() {
  return (
    <div className="w-[9.5rem] space-y-1.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-sm text-var">4/10</span>
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line">
          <span className="block h-full w-2/3 bg-var" />
        </span>
      </div>
      <div className="rounded-md border border-line px-2 py-1.5"><div className={`${bar} w-3/4`} /></div>
      <div className="rounded-md border-2 border-var bg-ok-bg px-2 py-1.5"><div className="h-2.5 w-1/2 rounded-full bg-var" /></div>
      <div className="rounded-md border border-line px-2 py-1.5"><div className={`${bar} w-2/3`} /></div>
    </div>
  );
}

function SurvivalThumb() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="grid size-6 place-items-center rounded-full bg-var text-[11px] font-black text-bg">✓</span>
        ))}
        <span className="grid size-6 place-items-center rounded-full bg-ko text-[11px] font-black text-bg">✕</span>
      </div>
      <span className="font-display text-sm uppercase tracking-wide text-muted">Hasta el primer fallo</span>
    </div>
  );
}

function TimeThumb() {
  return (
    <div className="relative grid size-24 place-items-center rounded-full" style={{ background: "conic-gradient(var(--color-var) 0 68%, var(--color-line) 68% 100%)" }}>
      <div className="grid size-[4.9rem] place-items-center rounded-full bg-screen">
        <span className="font-display text-3xl leading-none text-text">90<span className="text-base text-var">s</span></span>
      </div>
    </div>
  );
}

function HigherLowerThumb() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-16 rounded-lg border border-line bg-surface p-2 text-center">
        <div className={`${bar} mx-auto w-3/4`} />
        <p className="mt-2 font-display text-lg leading-none text-var">80M</p>
      </div>
      <div className="flex flex-col gap-1 pb-1 text-[10px] font-black">
        <span className="rounded bg-var px-1.5 py-0.5 text-bg">▲</span>
        <span className="rounded border border-line px-1.5 py-0.5 text-muted">▼</span>
      </div>
      <div className="w-16 rounded-lg border-2 border-var bg-surface p-2 text-center">
        <div className={`${bar} mx-auto w-2/3`} />
        <p className="mt-2 font-display text-lg leading-none">?</p>
      </div>
    </div>
  );
}

function GuessThumb() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-20 w-16 place-items-end overflow-hidden rounded-lg border border-line bg-surface">
        <div className="absolute left-1/2 top-3 size-7 -translate-x-1/2 rounded-full bg-line" />
        <div className="h-8 w-14 rounded-t-full bg-line" />
        <span className="absolute inset-0 grid place-items-center font-display text-2xl text-var">?</span>
      </div>
      <div className="w-16 space-y-1.5">
        <div className="rounded border border-var/70 px-1.5 py-1"><div className="h-1.5 rounded-full bg-var" /></div>
        <div className="rounded border border-line px-1.5 py-1"><div className="h-1.5 w-3/4 rounded-full bg-line" /></div>
        <div className="rounded border border-dashed border-line px-1.5 py-1"><div className="h-1.5 w-1/2 rounded-full bg-line/50" /></div>
      </div>
    </div>
  );
}

function CareerThumb() {
  const rows = ["w-14", "w-10", "w-16", "w-12"];
  return (
    <div className="relative pl-4">
      <span className="absolute bottom-1 left-[5px] top-1 w-0.5 bg-line" />
      <div className="space-y-2.5">
        {rows.map((w, i) => (
          <div key={w} className="flex items-center gap-2">
            <span className={`relative -ml-4 size-3 rounded-full ${i < 3 ? "bg-var" : "border-2 border-line bg-screen"}`} />
            <span className={`h-1.5 w-7 rounded-full ${i < 3 ? "bg-muted/60" : "bg-line/50"}`} />
            <span className={`h-2.5 rounded-full ${w} ${i < 3 ? "bg-text/80" : "bg-line/50"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RetroThumb() {
  return (
    <div className="scanlines relative grid h-20 w-32 place-items-center overflow-hidden rounded-lg border border-line bg-bezel">
      <span className="font-display text-4xl leading-none tracking-wide text-[#f5d26b]">1986</span>
    </div>
  );
}

function GridThumb() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`size-6 rounded ${i === 4 ? "bg-var" : "border border-line"}`} />
      ))}
    </div>
  );
}

function LeagueThumb() {
  return (
    <div className="w-[9.5rem] space-y-1">
      {[1, 2, 3, 4].map((p) => (
        <div key={p} className={`flex items-center gap-2 rounded-md px-2 py-1 ${p === 2 ? "bg-ok-bg ring-1 ring-var" : "bg-surface"}`}>
          <span className={`font-display text-sm ${p === 1 ? "text-[#f5d26b]" : p === 2 ? "text-var" : "text-muted"}`}>{p}</span>
          <span className={`h-2 flex-1 rounded-full ${p === 2 ? "bg-var/70" : "bg-line"}`} />
          <span className="h-2 w-5 rounded-full bg-line" />
        </div>
      ))}
    </div>
  );
}
