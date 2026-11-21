import Link from "next/link";
import { Suspense } from "react";
import { GameTiles } from "@/components/game/GameTiles";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Corners } from "@/components/brand/Logo";
import { getCurrentProfile, getModeStats } from "@/lib/auth";

const STANDINGS = [
  { pos: 1, name: "Jugador 1", pts: 2840, form: "▲" },
  { pos: 2, name: "Tú", pts: 2715, form: "▲", me: true },
  { pos: 3, name: "Jugador 3", pts: 2590, form: "▼" },
  { pos: 4, name: "Jugador 4", pts: 2410, form: "▬" },
  { pos: 5, name: "Jugador 5", pts: 2205, form: "▼" },
];

const THEMES = ["Liga", "Champions", "Mundial", "Eurocopa", "Premios", "Récords", "Fichajes", "Trayectorias"];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Games />
        <Leagues />
        <HowItWorks />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

function Games() {
  return (
    <section id="juegos" className="glow-top scroll-mt-24 sm:scroll-mt-28">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-12">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="font-display text-4xl uppercase leading-none sm:text-6xl">
            Juegos de fútbol <span className="text-var">cada día</span>
          </h1>
          <p className="mt-3 text-muted">
            Responde, pulsa CHECK THE VAR y descubre si es gol. Sin cuenta: el reto diario. Con cuenta gratis: todos.
          </p>
        </div>
        <Suspense fallback={<GameTiles bests={null} loggedIn={false} />}>
          <GamesWithStats />
        </Suspense>
      </div>
    </section>
  );
}

async function GamesWithStats() {
  const profile = await getCurrentProfile();
  const bests = profile ? await getModeStats() : null;
  return <GameTiles bests={bests} loggedIn={Boolean(profile)} />;
}

function Leagues() {
  return (
    <section id="ligas" className="scroll-mt-24 sm:scroll-mt-28">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl uppercase leading-none sm:text-5xl">
            Una temporada de verdad, con tus amigos
          </h2>
          <p className="mt-4 text-muted">
            Crea tu liga, invita a tu grupo y compite jornada a jornada. Cada semana, una temática
            distinta: el líder, el máximo acertante y la mejor racha se llevan su trofeo a la vitrina.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <span key={t} className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                {t}
              </span>
            ))}
          </div>
          <Link
            href="/ligas"
            className="mt-8 inline-block rounded-xl bg-var px-6 py-3.5 font-bold text-bg hover:brightness-110"
          >
            Crear mi liga
          </Link>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl uppercase">
              Clasificación · <span className="text-var">Jornada 7</span>
            </h3>
            <span className="text-xs text-muted">Ejemplo</span>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="pb-2 font-semibold">#</th>
                <th className="pb-2 font-semibold">Jugador</th>
                <th className="pb-2 text-right font-semibold">Pts</th>
                <th className="pb-2 text-right font-semibold">Forma</th>
              </tr>
            </thead>
            <tbody>
              {STANDINGS.map((r) => (
                <tr key={r.pos} className={`border-t border-line/60 ${r.me ? "text-var" : ""}`}>
                  <td className="py-2.5 font-bold">{r.pos}</td>
                  <td className="py-2.5 font-semibold">{r.name}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.pts.toLocaleString("es-ES")}</td>
                  <td className={`py-2.5 text-right ${r.form === "▼" ? "text-ko" : r.form === "▲" ? "text-var" : "text-muted"}`}>
                    {r.form}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Elige tu respuesta", text: "Lee la pregunta y elige antes de que se acabe el tiempo." },
    { n: "02", title: "Check the VAR", text: "Pulsa el botón y espera a que el árbitro revise la jugada." },
    { n: "03", title: "¿Gol o anulado?", text: "Suma puntos, haz hat-tricks y sube en la clasificación." },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-24 sm:scroll-mt-28 border-t border-line/60">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-4xl uppercase">Cómo funciona</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6">
              <span className="font-display text-4xl text-var">{s.n}</span>
              <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 py-20">
      <div className="scanlines relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-line bg-screen px-6 py-14 text-center">
        <Corners />
        <h2 className="relative font-display text-4xl uppercase sm:text-5xl">
          Guarda tus puntos. <span className="text-var">Sube en la tabla.</span>
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-muted">
          Juega ya el reto de hoy. Regístrate gratis para guardar todos tus puntos, mantener tu racha y
          competir en ligas.
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/registro" className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg hover:brightness-110">
            Crear cuenta gratis
          </Link>
          <Link href="/jugar/diario" className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold hover:border-var">
            Jugar sin cuenta
          </Link>
        </div>
      </div>
    </section>
  );
}
