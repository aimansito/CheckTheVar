"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { CLARITY_ID } from "@/lib/site";

/**
 * Aviso de cookies (ventana de "revisión VAR" que bloquea la página hasta elegir) y carga de
 * Microsoft Clarity. Clarity solo se descarga si el usuario acepta. Rechazar está al mismo nivel
 * que aceptar y no impide usar la web (criterio AEPD: nada de muros de cookies).
 * Sin NEXT_PUBLIC_CLARITY_ID no se muestra nada: las cookies técnicas no necesitan aviso.
 */
type Choice = "granted" | "denied" | null;

const KEY = "ctv_consent";
const EVENT = "ctv:consent";
const OPEN = "ctv:cookies-open";

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function save(choice: Exclude<Choice, null> | null) {
  try {
    if (choice) localStorage.setItem(KEY, choice);
    else localStorage.removeItem(KEY);
  } catch {
    // Navegación privada o almacenamiento bloqueado: el aviso volverá a salir.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

function loadClarity(id: string) {
  const w = window as unknown as { clarity?: ClarityFn };
  if (w.clarity) return;
  const fn: ClarityFn = (...args: unknown[]) => {
    (fn.q ??= []).push(args);
  };
  w.clarity = fn;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  fn("consent");
}

export function CookieConsent() {
  // En el servidor devolvemos "denied" para no pintar nada y evitar saltos al hidratar.
  const choice = useSyncExternalStore(subscribe, read, () => "denied" as Choice);
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const accept = useRef<HTMLButtonElement>(null);
  // En los textos legales no se bloquea la pantalla: hay que poder leer la política antes de decidir.
  const show = Boolean(CLARITY_ID) && choice === null && !pathname.startsWith("/legal");

  useEffect(() => {
    if (CLARITY_ID && choice === "granted") loadClarity(CLARITY_ID);
  }, [choice]);

  useEffect(() => {
    const reopen = () => {
      // Si retira el consentimiento después de aceptar, recargamos para quitar Clarity de la página.
      const wasGranted = read() === "granted";
      save(null);
      if (wasGranted) window.location.reload();
    };
    window.addEventListener(OPEN, reopen);
    return () => window.removeEventListener(OPEN, reopen);
  }, []);

  // Aparece un instante después de entrar, como la revisión del VAR tras la jugada.
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => {
      if (dialog.current && !dialog.current.open) {
        dialog.current.showModal();
        accept.current?.focus();
      }
    }, 700);
    return () => window.clearTimeout(t);
  }, [show]);

  if (!show) return null;

  const decide = (c: "granted" | "denied") => {
    dialog.current?.close();
    save(c);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="cookies-title"
      aria-describedby="cookies-text"
      // Solo se cierra eligiendo: Escape no vale.
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-visible bg-transparent p-0 text-text open:animate-pop backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <div className="rounded-3xl border border-line bg-bezel p-2 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest">
          <span className="flex items-center gap-2 text-ko">
            <span className="h-2 w-2 rounded-full bg-ko animate-blink" aria-hidden />
            Revisión VAR
          </span>
          <span className="text-muted">Revisando la jugada…</span>
        </div>

        <div className="scanlines relative overflow-hidden rounded-2xl border border-line bg-screen px-6 py-8 sm:px-8">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-var/10 to-transparent animate-scan" />
          <p className="relative text-xs font-bold uppercase tracking-wider text-var">Antes de empezar</p>
          <h2 id="cookies-title" className="relative mt-1 font-display text-4xl uppercase leading-none sm:text-5xl">
            El VAR necesita <span className="text-var text-glow">tu decisión</span>
          </h2>
          <p id="cookies-text" className="relative mt-4 text-sm leading-relaxed text-muted">
            Queremos ver qué jugadas funcionan y cuáles no para mejorar el juego. Para eso usamos cookies de analítica
            (Microsoft Clarity), que solo se activan si aceptas. Puedes cambiarlo cuando quieras en «Configurar
            cookies», al pie de la web.{" "}
            <Link href="/legal/cookies" className="font-semibold text-text underline">
              Más información
            </Link>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-2xl border border-line bg-surface px-4 py-4 text-left transition hover:border-ko"
          >
            <span className="block font-display text-2xl uppercase leading-none">Rechazar</span>
            <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-muted">Solo las necesarias</span>
          </button>
          <button
            ref={accept}
            type="button"
            onClick={() => decide("granted")}
            className="rounded-2xl bg-var px-4 py-4 text-left text-bg transition hover:brightness-110"
          >
            <span className="block font-display text-2xl uppercase leading-none">Aceptar</span>
            <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider">Ayudar a mejorar</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Enlace del pie para cambiar la elección en cualquier momento. */
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!CLARITY_ID) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN))} className={className}>
      Configurar cookies
    </button>
  );
}
