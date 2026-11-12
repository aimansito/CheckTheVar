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
      className="m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 text-text open:animate-pop backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-var">
          <span className="h-1.5 w-1.5 rounded-full bg-var" aria-hidden />
          Revisión VAR
        </p>
        <h2 id="cookies-title" className="mt-3 font-display text-3xl uppercase leading-none">
          ¿Nos ayudas a mejorar?
        </h2>
        <p id="cookies-text" className="mt-3 text-sm leading-relaxed text-muted">
          Usamos cookies de analítica (Microsoft Clarity) solo si aceptas. Puedes cambiarlo cuando quieras al pie de la
          web.{" "}
          <Link href="/legal/cookies" className="text-text underline">
            Más información
          </Link>
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-xl border border-line px-4 py-3 text-sm font-bold transition hover:border-muted"
          >
            Rechazar
          </button>
          <button
            ref={accept}
            type="button"
            onClick={() => decide("granted")}
            className="rounded-xl bg-var px-4 py-3 text-sm font-bold text-bg transition hover:brightness-110"
          >
            Aceptar
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
