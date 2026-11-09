import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Mi perfil" };

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

  const stats = [
    { label: "Puntos", value: profile.totalPoints.toLocaleString("es-ES") },
    { label: "Racha actual", value: `${profile.currentStreak} ${profile.currentStreak === 1 ? "día" : "días"}` },
    { label: "Mejor racha", value: `${profile.bestStreak} ${profile.bestStreak === 1 ? "día" : "días"}` },
  ];

  return (
    <>
      {params.bienvenida && (
        <div className="mb-6 rounded-2xl bg-var p-5 text-bg">
          <p className="font-display text-3xl uppercase">Fichaje confirmado</p>
          <p className="font-semibold">Tu cuenta está lista. Si jugaste como invitado, tus puntos ya están aquí.</p>
        </div>
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

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/jugar/diario" className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg hover:brightness-110">
          Jugar el reto de hoy
        </Link>
        <form action={signOut}>
          <button className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold hover:border-ko">
            Cerrar sesión
          </button>
        </form>
      </div>

      <p className="mt-10 rounded-xl border border-dashed border-line p-4 text-sm text-muted">
        Próximamente: vitrina de trofeos, estadísticas por categoría y tus ligas.
      </p>
    </>
  );
}
