"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/** Menú hamburguesa (móvil y tablet): secciones arriba y, separado, el bloque de sesión. */
export function MobileMenu({ nav, account }: { nav: { href: string; label: string }[]; account: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border bg-surface text-text ${open ? "border-var" : "border-line"}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <>
          {/* Fondo: al tocar fuera se cierra. Absoluto y no fixed: el backdrop-blur del header
              crea un bloque contenedor y un fixed quedaría encerrado en la cabecera. */}
          <div className="absolute inset-x-0 top-full z-30 h-dvh bg-black/70" onClick={() => setOpen(false)} aria-hidden />
          <nav
            id="mobile-menu"
            aria-label="Menú"
            // Cualquier enlace pulsado cierra el menú.
            onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
            className="absolute inset-x-0 top-full z-40 border-b border-line bg-bg px-4 pb-6 pt-2 shadow-2xl shadow-black/60"
          >
            <ul className="flex flex-col">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center justify-between border-b border-line/60 py-4 text-lg font-semibold">
                    {item.label}
                    <span className="text-muted" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted">Tu cuenta</p>
            <div className="mt-3">{account}</div>
          </nav>
        </>
      )}
    </div>
  );
}
