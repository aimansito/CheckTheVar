import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getCurrentProfile } from "@/lib/auth";
import { levelLabel } from "@/lib/format";
import { MODES } from "@/lib/game/modes";

export const metadata: Metadata = { title: "Bienvenido", robots: { index: false, follow: false } };

/** Primera pantalla tras confirmar la cuenta: invita a jugar el reto diario. */
export default function WelcomePage() {
  return (
    <>
      <SiteHeader />
      <main className="glow-top flex-1">
        <Suspense fallback={<p className="py-16 text-center text-muted">Preparando el vestuario…</p>}>
          <Welcome />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Welcome() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");

  // Con puntos ya en la cuenta, casi seguro jugó el reto de hoy como invitado y se le traspasaron.
  const playedAsGuest = profile.totalPoints > 0;
  const others = MODES.filter((m) => m.available && m.slug !== "daily").slice(0, 4);

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:py-20">
      <p className="text-sm font-bold uppercase tracking-wider text-var">Fichaje confirmado</p>
      <h1 className="mt-2 font-display text-5xl uppercase leading-none sm:text-6xl">
        Bienvenido, <span className="text-var">@{profile.username}</span>
      </h1>
      <p className="mx-auto mt-4 max-w-md text-muted">
        Tu cuenta está activa. {levelLabel(profile.difficulty)}: lo puedes cambiar antes de cada partida.
      </p>

      {playedAsGuest ? (
        <>
          <p className="mx-auto mt-6 max-w-md rounded-2xl border border-var bg-ok-bg px-5 py-4 font-semibold">
            Tus {profile.totalPoints.toLocaleString("es-ES")} puntos de invitado ya están en tu cuenta.
          </p>
          <Link href="/jugar" className="mt-8 inline-block rounded-xl bg-var px-8 py-4 text-lg font-bold text-bg hover:brightness-110">
            Elegir un juego
          </Link>
        </>
      ) : (
        <div className="mt-10 rounded-3xl border border-line bg-surface p-6 text-left sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-var">Tu primera jugada</p>
          <p className="mt-1 font-display text-3xl uppercase">¿Juegas el reto de hoy?</p>
          <p className="mt-2 text-sm text-muted">10 preguntas, las mismas para todos. Empieza tu racha hoy y vuelve mañana.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/jugar/diario" className="rounded-xl bg-var px-6 py-3.5 text-center font-bold text-bg hover:brightness-110">
              Jugar el reto diario
            </Link>
            <Link href="/jugar" className="rounded-xl border border-line px-6 py-3.5 text-center font-bold hover:border-var">
              Ver todos los juegos
            </Link>
          </div>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-3 text-left">
        {others.map((m) => (
          <Link key={m.slug} href={`/jugar/${m.path}`} className="rounded-2xl border border-line bg-surface p-4 transition hover:border-var">
            <p className="font-display text-xl uppercase">{m.name}</p>
            <p className="mt-1 text-xs text-muted">{m.tagline}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
