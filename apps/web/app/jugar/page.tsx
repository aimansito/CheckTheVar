import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { GameTiles } from "@/components/game/GameTiles";
import { getCurrentProfile, getModeStats } from "@/lib/auth";

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
        <h1 className="mb-8 font-display text-5xl uppercase">Elige tu juego</h1>
        <Suspense fallback={<GameTiles bests={null} loggedIn={false} />}>
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
  return <GameTiles bests={bests} loggedIn={Boolean(profile)} />;
}
