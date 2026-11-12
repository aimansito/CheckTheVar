import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Game } from "@/components/game/Game";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { currentUserId, viewLeague } from "@/lib/leagues";

export const metadata: Metadata = { title: "Jornada de liga", robots: { index: false, follow: false } };

export default function MatchdayPage({ params }: PageProps<"/ligas/[id]/jornada">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<p className="py-20 text-center text-muted">Preparando la jornada…</p>}>
          <Matchday params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Matchday({ params }: { params: PageProps<"/ligas/[id]/jornada">["params"] }) {
  const leagueId = Number((await params).id);
  if (!Number.isInteger(leagueId) || leagueId <= 0) notFound();
  const userId = await currentUserId();
  if (!userId) redirect(`/entrar?next=/ligas/${leagueId}`);
  const l = await viewLeague(userId, leagueId);
  if (!l) notFound();
  // Sin jornada abierta (o ya jugada): de vuelta a la liga.
  if (!l.current || l.current.myStatus === "played") redirect(`/ligas/${leagueId}`);
  return <Game mode="league" matchdayId={l.current.id} leagueId={leagueId} />;
}
