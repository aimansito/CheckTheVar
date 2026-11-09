import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { getCurrentProfile } from "@/lib/auth";

const NAV = [
  { href: "/#modos", label: "Juegos" },
  { href: "/#ligas", label: "Ligas" },
  { href: "/#como-funciona", label: "Cómo funciona" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo size="sm" />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-text">
              {item.label}
            </Link>
          ))}
        </nav>
        <Suspense fallback={<div className="h-10 w-40" aria-hidden />}>
          <AccountSlot />
        </Suspense>
      </div>
    </header>
  );
}

async function AccountSlot() {
  const profile = await getCurrentProfile();
  if (profile) {
    return (
      <Link
        href="/perfil"
        className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold"
      >
        <span className="text-var">{profile.totalPoints.toLocaleString("es-ES")} pts</span>
        <span className="hidden text-muted sm:inline">@{profile.username}</span>
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Link href="/entrar" className="hidden rounded-lg px-3 py-2 text-muted hover:text-text sm:inline">
        Iniciar sesión
      </Link>
      <Link href="/registro" className="rounded-lg bg-var px-4 py-2.5 text-bg hover:brightness-110">
        Registrarse gratis
      </Link>
    </div>
  );
}
