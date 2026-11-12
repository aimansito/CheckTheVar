import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Corners } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CreateLeagueForm, JoinLeagueForm } from "@/components/leagues/LeagueForms";
import { getCurrentProfile } from "@/lib/auth";
import { formatWhen, levelLabel } from "@/lib/format";
import { listLeagues, type LeagueSummary } from "@/lib/leagues";

export const metadata: Metadata = {
  title: "Ligas",
  description: "Crea una liga privada con tus amigos: una jornada temática por semana, clasificación y trofeos.",
};

export default function LeaguesPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<p className="py-16 text-center text-muted">Abriendo el vestuario…</p>}>
          <Leagues />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Leagues() {
  const profile = await getCurrentProfile();
  if (!profile) return <LeaguesIntro />;
  const leagues = await listLeagues(profile.id);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-wider text-var">Ligas</p>
        <h1 className="font-display text-5xl uppercase">Mis ligas</h1>
        {leagues.length ? (
          <ul className="mt-6 space-y-3">
            {leagues.map((l) => (
              <LeagueRow key={l.id} l={l} />
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-line p-5 text-muted">
            Todavía no juegas ninguna liga. Crea una y pasa el código a tu grupo, o únete con el código que te hayan enviado.
          </p>
        )}
      </section>

      <aside className="min-w-0 space-y-6">
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-3xl uppercase">Unirme a una liga</h2>
          <div className="mt-4">
            <JoinLeagueForm />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-3xl uppercase">Crear una liga</h2>
          <p className="mt-1 text-sm text-muted">Privada, hasta 20 jugadores, 10 jornadas por temporada.</p>
          <div className="mt-4">
            <CreateLeagueForm defaultDifficulty={profile.difficulty} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function LeagueRow({ l }: { l: LeagueSummary }) {
  return (
    <li>
      <Link href={`/ligas/${l.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:border-var">
        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-bezel font-display text-var">
          <span className="text-2xl leading-none">{l.position ?? "–"}</span>
          <span className="text-[9px] text-muted">PUESTO</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-2xl uppercase">{l.name}</span>
          <span className="block text-sm text-muted">
            {l.format === "head_to_head" ? "1 contra 1" : "Por puntos"} · {l.members} {l.members === 1 ? "jugador" : "jugadores"} · {levelLabel(l.difficulty)}
          </span>
          {l.matchday && (
            <span className="block text-xs text-muted">
              Jornada {l.matchday} · {l.theme} · cierra {formatWhen(l.closesAt)}
            </span>
          )}
        </span>
        {l.matchday && (
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase ${l.played ? "border border-line text-muted" : "bg-var text-bg"}`}>
            {l.played ? "Jugada" : "Por jugar"}
          </span>
        )}
      </Link>
    </li>
  );
}

/** Sin sesión: qué es una liga. */
function LeaguesIntro() {
  return (
    <section className="glow-top">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="scanlines relative overflow-hidden rounded-3xl border border-line bg-screen px-6 py-14">
          <Corners />
          <h1 className="relative font-display text-5xl uppercase leading-none sm:text-6xl">
            Una temporada de verdad, <span className="text-var">con tus amigos</span>
          </h1>
          <p className="relative mx-auto mt-4 max-w-xl text-muted">
            Crea una liga privada, pasa el código y compite jornada a jornada: una temática cada semana, por puntos o 1 contra 1. El campeón se lleva su trofeo.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/registro?next=/ligas" className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg hover:brightness-110">
              Crear cuenta gratis
            </Link>
            <Link href="/entrar?next=/ligas" className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold hover:border-var">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
