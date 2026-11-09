import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line/60">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center">
        <Logo size="sm" />
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/legal/aviso" className="hover:text-text">Aviso legal</Link>
          <Link href="/legal/privacidad" className="hover:text-text">Privacidad</Link>
          <Link href="/legal/cookies" className="hover:text-text">Cookies</Link>
          <a href="mailto:hola@checkthevar.es" className="hover:text-text">Contacto</a>
        </nav>
        <p>Juego independiente. Sin relación con ligas, clubes ni federaciones.</p>
      </div>
    </footer>
  );
}
