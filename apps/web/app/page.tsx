import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Corners } from "@/components/brand/Logo";

const MODES = [
  { name: "Reto diario", desc: "10 preguntas, iguales para todos. Vuelve mañana y mantén la racha.", free: true, href: "/jugar/diario" },
  { name: "Grid", desc: "Nombra al jugador que cumpla la fila y la columna.", free: false },
  { name: "Adivina el jugador", desc: "Pistas que se van destapando. Cuantas menos uses, más puntos.", free: false },
  { name: "Trayectoria", desc: "Adivina quién es solo por la lista de clubes.", free: false },
  { name: "Más o menos", desc: "Fichajes, goles y récords: ¿más o menos?", free: false },
  { name: "Liga por temporada", desc: "Compite cada semana con tus amigos. Jornadas temáticas.", free: false, star: true },
];

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
        <Hero />
        <Modes />
        <Leagues />
        <HowItWorks />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="glow-top">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 md:grid-cols-[1.25fr_1fr] md:pt-20">
        <div>
          <span className="inline-block rounded-md bg-var px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-bg">
            Reto diario disponible
          </span>
          <h1 className="mt-5 font-display text-5xl uppercase leading-[0.95] sm:text-7xl">
            ¿Sabes de fútbol?
            <br />
            <span className="text-var">Que lo diga el VAR.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Retos diarios, rachas y ligas con tus amigos. Responde, pulsa CHECK THE VAR y descubre si es
            gol confirmado.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/jugar/diario"
              className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg transition hover:brightness-110"
            >
              Jugar el reto de hoy
            </Link>
            <Link
              href="/registro"
              className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold transition hover:border-var"
            >
              Crear liga
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">Sin registro: juega 1 reto al día. Con cuenta gratis: juegos, rachas y ligas.</p>
        </div>
        <PhoneMock />
      </div>
    </section>
  );
}

/** Maqueta del juego (ilustrativa, no interactiva). */
function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-[330px] rounded-[2.2rem] border border-line bg-bezel p-3 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
      <div className="rounded-[1.7rem] bg-bg p-5">
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span>Pregunta 4/10</span>
          <span className="text-var">⏱ 12 s</span>
        </div>
        <p className="mt-4 text-lg font-bold leading-snug">¿Qué selección ganó el Mundial de 2010?</p>
        <div className="mt-4 space-y-2 text-sm font-semibold">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">Países Bajos</div>
          <div className="rounded-xl border-2 border-var bg-ok-bg px-4 py-3">España</div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3">Alemania</div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-text py-3 font-display text-xl text-bg">
          CHECK THE <span className="rounded-md bg-screen px-2 text-var">VAR</span>
        </div>
        <div className="mt-3 rounded-xl bg-var py-2.5 text-center font-display text-xl text-bg">
          GOL CONFIRMADO <span className="font-sans text-sm font-extrabold">+142</span>
        </div>
      </div>
    </div>
  );
}

function Modes() {
  return (
    <section id="modos" className="scroll-mt-20 border-y border-line/60 bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-4xl uppercase">Modos de juego</h2>
        <p className="mt-2 text-muted">Partidas cortas para cada día y retos para los que de verdad saben.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => {
            const card = (
              <div
                className={`h-full rounded-2xl border bg-surface p-5 transition ${
                  m.href ? "border-var/60 hover:border-var" : "border-line"
                } ${m.star ? "bg-gradient-to-br from-ok-bg/60 to-surface" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-2xl uppercase">{m.name}</h3>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                      m.free ? "bg-var text-bg" : "border border-line text-muted"
                    }`}
                  >
                    {m.free ? "Gratis" : "Con cuenta"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{m.desc}</p>
                {m.href && <p className="mt-4 text-sm font-bold text-var">Jugar ahora →</p>}
              </div>
            );
            return m.href ? (
              <Link key={m.name} href={m.href}>
                {card}
              </Link>
            ) : (
              <div key={m.name}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Leagues() {
  return (
    <section id="ligas" className="scroll-mt-20">
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
            href="/registro"
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
    <section id="como-funciona" className="scroll-mt-20 border-t border-line/60">
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
