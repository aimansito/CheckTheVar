"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { CLARITY_ID } from "@/lib/site";

/**
 * Aviso de cookies y carga de Microsoft Clarity.
 * Clarity solo se descarga si el usuario acepta. Rechazar es tan fácil como aceptar (criterio AEPD).
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
  // En el servidor devolvemos "denied" para no pintar el aviso y evitar saltos al hidratar.
  const choice = useSyncExternalStore(subscribe, read, () => "denied" as Choice);

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

  if (!CLARITY_ID || choice !== null) return null;

  return (
    <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted">
          Usamos cookies de analítica (Microsoft Clarity) para ver cómo se usa la web y mejorarla. Solo se activan si
          aceptas.{" "}
          <Link href="/legal/cookies" className="font-semibold text-text underline">
            Más información
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => save("denied")}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-bold hover:border-var"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => save("granted")}
            className="rounded-xl bg-var px-5 py-2.5 text-sm font-bold text-bg hover:brightness-110"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
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
