import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DifficultyForm } from "@/components/leagues/LeagueForms";
import { getCurrentProfile, getModeStats, getTrophies } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { MODES } from "@/lib/game/modes";

export const metadata: Metadata = { title: "Mi perfil", robots: { index: false, follow: false } };

export default function ProfilePage({ searchParams }: PageProps<"/perfil">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Suspense fallback={<p className="text-muted">Cargando tu vestuario…</p>}>
          <Profile searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Profile({ searchParams }: { searchParams: PageProps<"/perfil">["searchParams"] }) {
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  if (!profile) redirect("/entrar");
  const [modeStats, trophies] = await Promise.all([getModeStats(), getTrophies()]);

  const accuracy = profile.answersTotal ? Math.round((profile.answersCorrect / profile.answersTotal) * 100) : null;
  const stats = [
    { label: "Puntos", value: profile.totalPoints.toLocaleString("es-ES") },
    { label: "Racha actual", value: `${profile.currentStreak} ${profile.currentStreak === 1 ? "día" : "días"}` },
    { label: "Mejor racha", value: `${profile.bestStreak} ${profile.bestStreak === 1 ? "día" : "días"}` },
    { label: "Partidas", value: profile.gamesPlayed.toLocaleString("es-ES") },
    { label: "Goles confirmados", value: accuracy === null ? "—" : `${accuracy} %` },
  ];

  return (
    <>
      {params.bienvenida && (
        <div className="mb-6 rounded-2xl bg-var p-5 text-bg">
          <p className="font-display text-3xl uppercase">Fichaje confirmado</p>
          <p className="font-semibold">Tu cuenta está lista. Si jugaste como invitado, tus puntos ya están aquí.</p>
        </div>
      )}
      {params.contrasena && (
        <div className="mb-6 rounded-2xl border border-var bg-ok-bg p-4 text-sm font-semibold">Contraseña cambiada. Ya puedes seguir jugando.</div>
      )}
      <p className="text-sm font-semibold uppercase tracking-wider text-var">Mi perfil</p>
      <h1 className="font-display text-5xl uppercase">@{profile.username}</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-1 font-display text-4xl text-var">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-3xl uppercase">Vitrina de trofeos</h2>
      {trophies.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {trophies.map((t) => (
            <li key={t.id} className="rounded-2xl border border-var/60 bg-ok-bg/50 p-4 font-semibold">
              🏆 {t.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          Aún vacía. Gana una temporada en una{" "}
          <Link href="/ligas" className="font-semibold text-text underline">
            liga con tus amigos
          </Link>{" "}
          o sé el máximo acertante y tu trofeo aparecerá aquí.
        </p>
      )}

      <h2 className="mt-10 font-display text-3xl uppercase">Mis marcas</h2>
      <ul className="mt-4 divide-y divide-line/60 rounded-2xl border border-line bg-surface">
        {MODES.filter((m) => m.available).map((m) => {
          const s = modeStats[m.slug];
          return (
            <li key={m.slug} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <p className="font-bold">{m.name}</p>
                <p className="text-xs text-muted">
                  {s ? `${s.gamesPlayed} ${s.gamesPlayed === 1 ? "partida" : "partidas"} · mejor racha ${s.bestStreak}` : "Sin jugar todavía"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {s && <span className="font-display text-2xl text-var">{s.bestScore.toLocaleString("es-ES")}</span>}
                <Link href={`/jugar/${m.path}`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold hover:border-var">
                  Jugar
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 font-display text-3xl uppercase">Mi nivel</h2>
      <p className="mt-1 text-sm text-muted">El nivel con el que empiezan tus partidas. Lo puedes cambiar antes de cada una.</p>
      <div className="mt-4">
        <DifficultyForm current={profile.difficulty} />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/jugar/diario" className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg hover:brightness-110">
          Jugar el reto de hoy
        </Link>
        <Link href="/perfil/seguridad" className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold hover:border-var">
          Cambiar contraseña
        </Link>
        <form action={signOut}>
          <button className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold hover:border-ko">Cerrar sesión</button>
        </form>
      </div>
    </>
  );
}
