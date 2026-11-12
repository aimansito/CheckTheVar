import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { getCurrentProfile } from "@/lib/auth";

const NAV = [
  { href: "/jugar", label: "Juegos" },
  { href: "/ligas", label: "Ligas" },
  { href: "/#como-funciona", label: "Cómo funciona" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
      <div className="relative mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:h-24 sm:px-6">
        <Logo size="header" />
        <nav className="hidden items-center gap-9 text-base font-medium text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-text">
              {item.label}
            </Link>
          ))}
        </nav>
        {/* Ordenador */}
        <div className="hidden md:block">
          <Suspense fallback={<div className="h-12 w-44" aria-hidden />}>
            <AccountSlot />
          </Suspense>
        </div>
        {/* Móvil y tablet */}
        <MobileMenu
          nav={NAV}
          account={
            <Suspense fallback={<div className="h-28" aria-hidden />}>
              <MobileAccount />
            </Suspense>
          }
        />
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
        className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-base font-semibold"
      >
        <span className="text-var">{profile.totalPoints.toLocaleString("es-ES")} pts</span>
        <span className="text-muted">@{profile.username}</span>
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3 text-base font-semibold">
      <Link href="/entrar" className="rounded-lg px-3 py-2 text-muted hover:text-text">
        Iniciar sesión
      </Link>
      <Link href="/registro" className="rounded-xl bg-var px-5 py-3 text-bg hover:brightness-110">
        Registrarse gratis
      </Link>
    </div>
  );
}

/** Bloque de sesión dentro del menú hamburguesa. */
async function MobileAccount() {
  const profile = await getCurrentProfile();
  if (profile) {
    return (
      <Link href="/perfil" className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3.5 font-semibold">
        <span>
          Mi perfil <span className="text-muted">@{profile.username}</span>
        </span>
        <span className="text-var">{profile.totalPoints.toLocaleString("es-ES")} pts</span>
      </Link>
    );
  }
  return (
    <div className="grid gap-2 font-semibold">
      <Link href="/registro" className="rounded-xl bg-var px-4 py-3.5 text-center text-bg">
        Registrarse gratis
      </Link>
      <Link href="/entrar" className="rounded-xl border border-line bg-surface px-4 py-3.5 text-center">
        Iniciar sesión
      </Link>
    </div>
  );
}
