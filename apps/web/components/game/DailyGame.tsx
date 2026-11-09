"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameStart, PublicQuestion, SessionSummary, VarVerdict } from "@checkthevar/shared";
import { CheckTheVarButton } from "@/components/brand/CheckTheVarButton";
import { Corners, VarMonitor } from "@/components/brand/Logo";

/**
 * Reto diario. La UI NO decide aciertos ni calcula puntos: todo viene del servidor.
 * Flujo: start → next → (elegir) → CHECK THE VAR → revisión → veredicto → … → resumen.
 */

type Phase =
  | { kind: "loading" }
  | { kind: "question"; q: PublicQuestion; startedAt: number }
  | { kind: "reviewing"; q: PublicQuestion; choice: string | null }
  | { kind: "verdict"; q: PublicQuestion; v: VarVerdict }
  | { kind: "summary"; s: SessionSummary }
  | { kind: "error"; message: string };

const REVIEW_MS = 1400;

const ERRORS: Record<string, string> = {
  no_questions: "Hoy el VAR no tiene preguntas preparadas. Vuelve en un rato.",
  session_not_found: "No encontramos tu partida. Recarga la página.",
  session_closed: "Esta partida ya está cerrada.",
  server_error: "El VAR se ha caído. Prueba de nuevo en unos segundos.",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "server_error");
  return body;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DailyGame() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [session, setSession] = useState<GameStart | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const submitting = useRef(false);

  const fail = (err: unknown) => {
    const code = err instanceof Error ? err.message : "server_error";
    setPhase({ kind: "error", message: ERRORS[code] ?? ERRORS.server_error! });
  };

  const loadSummary = useCallback(async (sessionId: string) => {
    const s = await api<SessionSummary>(`/api/game/${sessionId}/summary`);
    setPhase({ kind: "summary", s });
  }, []);

  const loadNext = useCallback(
    async (sessionId: string) => {
      const next = await api<PublicQuestion | { done: true }>(`/api/game/${sessionId}/next`);
      if ("done" in next) {
        await loadSummary(sessionId);
        return;
      }
      setSelected(null);
      submitting.current = false;
      // El reloj sigue donde lo dejó el servidor (recargar no da tiempo extra).
      setPhase({ kind: "question", q: next, startedAt: Date.now() - next.elapsedMs });
    },
    [loadSummary],
  );

  // Empezar o retomar la partida de hoy.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const start = await api<GameStart>("/api/game/start", {
          method: "POST",
          body: JSON.stringify({ mode: "daily" }),
        });
        if (cancelled) return;
        setSession(start);
        setScore(start.score);
        if (start.status !== "started") await loadSummary(start.sessionId);
        else await loadNext(start.sessionId);
      } catch (err) {
        if (!cancelled) fail(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadNext, loadSummary]);

  const check = useCallback(
    async (choice: string | null) => {
      if (phase.kind !== "question" || !session || submitting.current) return;
      submitting.current = true;
      const q = phase.q;
      setPhase({ kind: "reviewing", q, choice });
      try {
        const body = choice ? { position: q.position, optionId: choice } : { position: q.position, timeout: true };
        const [v] = await Promise.all([
          api<VarVerdict>(`/api/game/${session.sessionId}/answer`, {
            method: "POST",
            body: JSON.stringify(body),
          }),
          wait(REVIEW_MS),
        ]);
        setScore(v.sessionScore);
        setPhase({ kind: "verdict", q, v });
      } catch (err) {
        fail(err);
      }
    },
    [phase, session],
  );

  if (phase.kind === "loading") return <Centered>Preparando el reto de hoy…</Centered>;
  if (phase.kind === "error")
    return (
      <Centered>
        <p>{phase.message}</p>
        <button onClick={() => location.reload()} className="mt-4 rounded-xl border border-line px-5 py-3 font-bold">
          Reintentar
        </button>
      </Centered>
    );
  if (phase.kind === "summary") return <Summary s={phase.s} />;

  const q = phase.q;
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <ScoreBar position={q.position} total={q.total} score={score} />

      <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-var">{q.category}</p>
        <h1 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">{q.prompt}</h1>
      </div>

      {phase.kind === "question" && (
        <Timer key={q.position} startedAt={phase.startedAt} limitMs={q.timeLimitMs} onTimeout={() => check(null)} />
      )}

      <ul className="mt-4 space-y-3">
        {q.options.map((o) => {
          const v = phase.kind === "verdict" ? phase.v : null;
          const chosen = phase.kind === "question" ? selected === o.id : phase.kind === "reviewing" ? phase.choice === o.id : v?.choice === o.id;
          const isRight = v && v.correctOptionId === o.id;
          const isWrongPick = v && chosen && !v.isCorrect;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={phase.kind !== "question"}
                onClick={() => setSelected(o.id)}
                className={`flex min-h-14 w-full items-center gap-4 rounded-xl border-2 px-4 py-3 text-left font-semibold transition ${
                  isRight
                    ? "border-var bg-ok-bg"
                    : isWrongPick
                      ? "border-ko bg-ko-bg"
                      : chosen
                        ? "border-text bg-bezel"
                        : "border-line bg-surface enabled:hover:border-muted"
                } ${v && !isRight && !isWrongPick ? "opacity-50" : ""}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg ${
                    isRight ? "bg-var text-bg" : "bg-bezel text-var"
                  }`}
                >
                  {o.id}
                </span>
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex justify-center">
        {phase.kind === "question" && <CheckTheVarButton disabled={!selected} onClick={() => check(selected)} />}
        {phase.kind === "verdict" && (
          <Verdict
            v={phase.v}
            onNext={async () => {
              if (!session) return;
              setPhase({ kind: "loading" });
              try {
                if (phase.v.isLast) await loadSummary(session.sessionId);
                else await loadNext(session.sessionId);
              } catch (err) {
                fail(err);
              }
            }}
          />
        )}
      </div>

      {phase.kind === "reviewing" && <ReviewOverlay />}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center text-muted">{children}</div>;
}

function ScoreBar({ position, total, score }: { position: number; total: number; score: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="text-muted">
          Pregunta <span className="text-text">{position}</span>/{total}
        </span>
        <span className="font-display text-xl text-var">{score.toLocaleString("es-ES")} pts</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < position - 1 ? "bg-var" : i === position - 1 ? "bg-text" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

/** Cuenta atrás visual. El tiempo real lo mide el servidor. */
function Timer({ startedAt, limitMs, onTimeout }: { startedAt: number; limitMs: number; onTimeout: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const timeoutRef = useRef(onTimeout);
  useEffect(() => {
    timeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, limitMs - (now - startedAt));
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      timeoutRef.current();
    }
  }, [left]);

  const pct = (left / limitMs) * 100;
  const color = pct > 40 ? "bg-var" : pct > 20 ? "bg-[#f5c542]" : "bg-ko";
  return (
    <div className="mt-4 flex items-center gap-3" role="timer" aria-label={`Quedan ${Math.ceil(left / 1000)} segundos`}>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bezel">
        <div className={`h-full rounded-full ${color} transition-[width] duration-100 ease-linear`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right font-display text-xl tabular-nums">{Math.ceil(left / 1000)}</span>
    </div>
  );
}

function ReviewOverlay() {
  return (
    <div className="scanlines fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-screen/95" role="status">
      <span aria-hidden className="pointer-events-none absolute left-6 top-6 h-16 w-16 border-l-4 border-t-4 border-var" />
      <span aria-hidden className="pointer-events-none absolute right-6 top-6 h-16 w-16 border-r-4 border-t-4 border-var" />
      <span aria-hidden className="pointer-events-none absolute bottom-6 left-6 h-16 w-16 border-b-4 border-l-4 border-var" />
      <span aria-hidden className="pointer-events-none absolute bottom-6 right-6 h-16 w-16 border-b-4 border-r-4 border-var" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-var/10 to-transparent" />
      <VarMonitor className="h-28 w-44">
        <span className="font-display text-6xl text-var text-glow">VAR</span>
      </VarMonitor>
      <p className="font-display text-4xl uppercase text-var text-glow">
        Revisando la jugada<span className="animate-blink">…</span>
      </p>
    </div>
  );
}

function Verdict({ v, onNext }: { v: VarVerdict; onNext: () => void }) {
  return (
    <div className="w-full animate-pop">
      {v.isCorrect ? (
        <div className="rounded-2xl bg-var p-5 text-center text-bg">
          <p className="font-display text-4xl uppercase sm:text-5xl">Gol confirmado</p>
          <p className="mt-1 text-lg font-extrabold">+{v.points} puntos</p>
          {v.isHatTrick && <p className="mt-2 inline-block rounded-md bg-bg px-3 py-1 text-sm font-extrabold text-var">⚽⚽⚽ Hat-trick · racha de {v.streak}</p>}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-ko bg-ko-bg p-5 text-center">
          <p className="font-display text-4xl uppercase text-ko sm:text-5xl">Gol anulado</p>
          <p className="mt-1 font-semibold">
            {v.timedOut ? "Se acabó el tiempo." : "Anulado por poco."} Era <span className="text-var">{v.correctLabel}</span>.
          </p>
        </div>
      )}
      {v.explanation && (
        <p className="mt-3 rounded-xl border border-line border-l-4 border-l-var bg-surface p-4 text-sm text-muted">
          <span className="font-bold text-text">Dato: </span>
          {v.explanation}
        </p>
      )}
      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="mt-4 w-full rounded-xl bg-text py-3.5 font-bold text-bg hover:brightness-90"
      >
        {v.isLast ? "Ver mi resultado" : "Siguiente pregunta"}
      </button>
    </div>
  );
}

function Summary({ s }: { s: SessionSummary }) {
  const isGuest = s.pendingPoints !== null;
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-var">Reto de hoy completado</p>
      <p className="mt-3 font-display text-7xl text-var text-glow">{s.score.toLocaleString("es-ES")}</p>
      <p className="font-display text-2xl uppercase">puntos</p>
      <p className="mt-4 text-muted">
        {s.correctCount} de {s.total} goles confirmados
        {s.status === "abandoned" ? " (partida abandonada)" : ""}
      </p>

      {isGuest ? (
        <div className="scanlines relative mt-8 overflow-hidden rounded-2xl border border-line bg-screen p-6">
          <Corners />
          <p className="relative font-display text-3xl uppercase">Regístrate y guarda estos puntos</p>
          <p className="relative mt-2 text-sm text-muted">
            Tienes {(s.pendingPoints ?? 0).toLocaleString("es-ES")} puntos pendientes. Con una cuenta gratis
            se suman a tu perfil y desbloqueas todos los juegos, rachas y ligas.
          </p>
          <Link href="/registro" className="relative mt-5 inline-block rounded-xl bg-var px-6 py-3.5 font-bold text-bg">
            Crear cuenta gratis
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <p className="font-display text-3xl uppercase">
            Racha: <span className="text-var">{s.streak ?? 0} {s.streak === 1 ? "día" : "días"}</span>
          </p>
          <p className="mt-2 text-sm text-muted">Mañana hay reto nuevo. No pierdas la racha.</p>
        </div>
      )}
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-muted hover:text-text">
        Volver al inicio
      </Link>
    </div>
  );
}
