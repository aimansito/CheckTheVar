import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getCurrentProfile, getModeStats, type ModeStats } from "@/lib/auth";
import { MODES } from "@/lib/game/modes";

export const metadata: Metadata = {
  title: "Juegos",
  description: "Reto diario, supervivencia, contrarreloj, más o menos, adivina el jugador y trayectoria.",
};

export default function PlayPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <p className="text-sm font-bold uppercase tracking-wider text-var">Sala del VAR</p>
        <h1 className="font-display text-5xl uppercase">Elige tu juego</h1>
        <Suspense fallback={<ModeGrid bests={null} loggedIn={false} />}>
          <ModeGridWithStats />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function ModeGridWithStats() {
  const profile = await getCurrentProfile();
  const bests = profile ? await getModeStats() : null;
  return <ModeGrid bests={bests} loggedIn={Boolean(profile)} />;
}

function ModeGrid({ bests, loggedIn }: { bests: ModeStats | null; loggedIn: boolean }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {MODES.map((m) => {
        const locked = !m.free && !loggedIn;
        const best = bests?.[m.slug];
        const body = (
          <div
            className={`flex h-full flex-col rounded-2xl border bg-surface p-5 transition ${
              m.available ? "border-line hover:border-var" : "border-dashed border-line opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl uppercase">{m.name}</h2>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase ${m.free ? "bg-var text-bg" : "border border-line text-muted"}`}>
                {!m.available ? "Pronto" : m.free ? "Gratis" : locked ? "Con cuenta" : "Desbloqueado"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">{m.tagline}</p>
            <p className="mt-3 text-xs text-muted">{m.howTo}</p>
            <div className="mt-auto flex items-center justify-between pt-4 text-sm font-bold">
              {m.available ? <span className="text-var">{locked ? "Crear cuenta →" : "Jugar →"}</span> : <span className="text-muted">Próximamente</span>}
              {best && best.gamesPlayed > 0 && (
                <span className="text-xs text-muted">
                  mejor <span className="text-text">{best.bestScore.toLocaleString("es-ES")}</span> · {best.gamesPlayed}{" "}
                  {best.gamesPlayed === 1 ? "partida" : "partidas"}
                </span>
              )}
            </div>
          </div>
        );
        return m.available ? (
          <Link key={m.slug} href={`/jugar/${m.path}`}>
            {body}
          </Link>
        ) : (
          <div key={m.slug}>{body}</div>
        );
      })}
    </div>
  );
}
