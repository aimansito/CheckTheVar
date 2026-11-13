"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  DIFFICULTY_LEVELS,
  MODE_RULES,
  type ClueReveal,
  type ClueRetry,
  type DifficultyLevel,
  type GameModeSlug,
  type GameStart,
  type PublicQuestion,
  type SessionSummary,
  type VarVerdict,
} from "@checkthevar/shared";
import { CheckTheVarButton } from "@/components/brand/CheckTheVarButton";
import { Corners, VarMonitor } from "@/components/brand/Logo";
import { DifficultyPicker } from "@/components/game/DifficultyPicker";
import { modeBySlug } from "@/lib/game/modes";

/**
 * Partida de cualquier modo. La UI NO decide aciertos ni calcula puntos: todo viene del servidor.
 * Flujo: (nivel) → start → next → (elegir o escribir) → CHECK THE VAR → revisión → veredicto → … → resumen.
 */

type Phase =
  | { kind: "setup" }
  | { kind: "loading"; text?: string }
  | { kind: "question"; q: PublicQuestion; startedAt: number; miss?: string }
  | { kind: "reviewing"; q: PublicQuestion; choice: string | null; startedAt: number }
  | { kind: "verdict"; q: PublicQuestion; v: VarVerdict }
  | { kind: "summary"; s: SessionSummary }
  | { kind: "error"; message: string };

const REVIEW_MS = 1400;

const ERRORS: Record<string, string> = {
  no_questions: "El VAR no tiene preguntas preparadas para este modo. Vuelve en un rato.",
  session_not_found: "No encontramos tu partida. Recarga la página.",
  session_closed: "Esta partida ya está cerrada.",
  account_required: "Este modo necesita una cuenta gratis.",
  rate_limited: "Demasiadas jugadas seguidas. Espera un momento.",
  matchday_closed: "Esta jornada ya está cerrada. Mira la clasificación de tu liga.",
  not_member: "No eres miembro de esta liga.",
  daily_limit: "Ya has jugado las 2 partidas de hoy a este juego. Cuenta tu mejor puntuación. ¡Vuelve mañana!",
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
const levelName = (d: string | null | undefined) =>
  d && d in DIFFICULTY_LEVELS ? DIFFICULTY_LEVELS[d as DifficultyLevel].name : null;

export function Game({
  mode,
  defaultDifficulty = "aficionado",
  matchdayId,
  leagueId,
}: {
  mode: GameModeSlug;
  defaultDifficulty?: DifficultyLevel;
  matchdayId?: number;
  leagueId?: number;
}) {
  const info = modeBySlug(mode);
  const needsSetup = mode !== "daily" && mode !== "league";
  const [phase, setPhase] = useState<Phase>(needsSetup ? { kind: "setup" } : { kind: "loading" });
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(defaultDifficulty);
  const [session, setSession] = useState<GameStart | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [score, setScore] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const submitting = useRef(false);
  const [round, setRound] = useState(needsSetup ? 0 : 1); // 0 = esperando a elegir nivel

  const fail = (err: unknown) => {
    const code = err instanceof Error ? err.message : "server_error";
    setPhase({ kind: "error", message: ERRORS[code] ?? ERRORS.server_error! });
  };

  const loadSummary = async (sessionId: string) => {
    const s = await api<SessionSummary>(`/api/game/${sessionId}/summary`);
    setPhase({ kind: "summary", s });
  };

  const loadNext = async (sessionId: string) => {
    const next = await api<PublicQuestion | { done: true }>(`/api/game/${sessionId}/next`);
    if ("done" in next) {
      await loadSummary(sessionId);
      return;
    }
    setSelected(null);
    setText("");
    submitting.current = false;
    setScore(next.sessionScore);
    if (next.endsInMs != null) setEndsAt(Date.now() + next.endsInMs);
    // El reloj sigue donde lo dejó el servidor (recargar no da tiempo extra).
    setPhase({ kind: "question", q: next, startedAt: Date.now() - next.elapsedMs });
  };

  const startGame = useEffectEvent(async (isCancelled: () => boolean) => {
    try {
      const start = await api<GameStart>("/api/game/start", {
        method: "POST",
        body: JSON.stringify({ mode, ...(needsSetup ? { difficulty } : {}), ...(matchdayId ? { matchdayId } : {}) }),
      });
      if (isCancelled()) return;
      setSession(start);
      setScore(start.score);
      if (start.endsInMs != null) setEndsAt(Date.now() + start.endsInMs);
      if (start.status !== "started") await loadSummary(start.sessionId);
      else await loadNext(start.sessionId);
    } catch (err) {
      if (!isCancelled()) fail(err);
    }
  });
  useEffect(() => {
    if (round === 0) return;
    let cancelled = false;
    // Todo el estado se actualiza tras la respuesta del servidor, nunca de forma síncrona.
    queueMicrotask(() => startGame(() => cancelled));
    return () => {
      cancelled = true;
    };
  }, [mode, round]);

  const begin = () => {
    setPhase({ kind: "loading" });
    setRound((r) => r + 1);
  };

  const check = async (answer: { optionId?: string; text?: string; timeout?: true }) => {
    if (phase.kind !== "question" || !session || submitting.current) return;
    submitting.current = true;
    const q = phase.q;
    const startedAt = phase.startedAt;
    setPhase({ kind: "reviewing", q, choice: answer.optionId ?? answer.text ?? null, startedAt });
    try {
      const [v] = await Promise.all([
        api<VarVerdict | ClueRetry>(`/api/game/${session.sessionId}/answer`, {
          method: "POST",
          body: JSON.stringify({ position: q.position, ...answer }),
        }),
        wait(REVIEW_MS),
      ]);
      if ("retry" in v) {
        // No es ese jugador: nueva pista y se sigue intentando (el reloj no se reinicia).
        setText("");
        submitting.current = false;
        setPhase({
          kind: "question",
          q: { ...q, clues: v.clues, cluesUsed: v.cluesUsed, cluesTotal: v.cluesTotal },
          startedAt,
          miss: v.answerText ?? answer.text,
        });
        return;
      }
      setScore(v.sessionScore);
      setPhase({ kind: "verdict", q, v });
    } catch (err) {
      fail(err);
    }
  };

  const askClue = async () => {
    if (phase.kind !== "question" || !session) return;
    try {
      const r = await api<ClueReveal>(`/api/game/${session.sessionId}/clue`, {
        method: "POST",
        body: JSON.stringify({ position: phase.q.position }),
      });
      setPhase({ ...phase, miss: undefined, q: { ...phase.q, clues: r.clues, cluesUsed: r.cluesUsed, cluesTotal: r.cluesTotal } });
    } catch (err) {
      fail(err);
    }
  };

  const abandon = async () => {
    if (!session || !confirm("¿Abandonar la partida? Contará con los puntos que llevas.")) return;
    setPhase({ kind: "loading", text: "Cerrando la partida…" });
    try {
      const s = await api<SessionSummary>(`/api/game/${session.sessionId}/abandon`, { method: "POST" });
      setPhase({ kind: "summary", s });
    } catch (err) {
      fail(err);
    }
  };

  const goNext = async () => {
    if (!session || phase.kind !== "verdict") return;
    const v = phase.v;
    setPhase({ kind: "loading" });
    try {
      if (v.isLast) await loadSummary(session.sessionId);
      else await loadNext(session.sessionId);
    } catch (err) {
      fail(err);
    }
  };

  if (phase.kind === "setup")
    return <Setup modeName={info.name} howTo={info.howTo} playsPerDay={MODE_RULES[mode].playsPerDay} difficulty={difficulty} onDifficulty={setDifficulty} onStart={begin} />;
  if (phase.kind === "loading") return <Centered>{phase.text ?? `Preparando ${info.name.toLowerCase()}…`}</Centered>;
  if (phase.kind === "error")
    return (
      <Centered>
        <p>{phase.message}</p>
        <div className="mt-4 flex gap-3">
          <button onClick={() => location.reload()} className="rounded-xl border border-line px-5 py-3 font-bold">
            Reintentar
          </button>
          <Link href={leagueId ? `/ligas/${leagueId}` : "/jugar"} className="rounded-xl border border-line px-5 py-3 font-bold">
            {leagueId ? "Volver a la liga" : "Otros juegos"}
          </Link>
        </div>
      </Centered>
    );
  if (phase.kind === "summary")
    return (
      <Summary
        s={phase.s}
        onAgain={needsSetup ? begin : undefined}
        onChangeLevel={needsSetup ? () => setPhase({ kind: "setup" }) : undefined}
      />
    );

  const q = phase.q;
  const isText = q.format === "free_text";
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <ScoreBar
        q={q}
        score={score}
        modeName={info.name}
        level={levelName(q.difficulty)}
        endsAt={endsAt}
        onTimeUp={() => session && loadNext(session.sessionId).catch(fail)}
      />

      <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-var">
          {q.category} · {isText ? "respuesta escrita" : "elige una"}
        </p>
        <h1 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">{q.prompt}</h1>
      </div>

      {phase.kind === "question" && (
        <Timer key={`timer-${q.position}`} startedAt={phase.startedAt} limitMs={q.timeLimitMs} onTimeout={() => check({ timeout: true })} />
      )}

      {isText ? (
        <Clues q={q} phase={phase} text={text} onText={setText} onClue={askClue} onSubmit={() => text.trim() && check({ text: text.trim() })} />
      ) : (
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
      )}

      <div className="mt-6 flex justify-center">
        {phase.kind === "question" && (
          <CheckTheVarButton
            disabled={isText ? !text.trim() : !selected}
            onClick={() => (isText ? text.trim() && check({ text: text.trim() }) : selected && check({ optionId: selected }))}
          />
        )}
        {phase.kind === "verdict" && <Verdict v={phase.v} onNext={goNext} />}
      </div>

      {needsSetup && phase.kind === "question" && (
        <p className="mt-8 text-center">
          <button type="button" onClick={abandon} className="text-xs font-semibold text-muted underline-offset-2 hover:text-ko hover:underline">
            Abandonar la partida
          </button>
        </p>
      )}

      {phase.kind === "reviewing" && <ReviewOverlay />}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center text-muted">{children}</div>;
}

/** Antes de empezar: reglas del modo y nivel. */
function Setup({
  modeName,
  howTo,
  playsPerDay,
  difficulty,
  onDifficulty,
  onStart,
}: {
  modeName: string;
  howTo: string;
  playsPerDay: number | null;
  difficulty: DifficultyLevel;
  onDifficulty: (d: DifficultyLevel) => void;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <div className="scanlines relative overflow-hidden rounded-2xl border border-line bg-screen px-6 py-6 text-center">
        <Corners />
        <h1 className="relative font-display text-4xl uppercase leading-none">{modeName}</h1>
        <p className="relative mt-2 text-sm text-muted">{howTo}</p>
        {playsPerDay && (
          <p className="relative mt-3 text-xs font-bold uppercase tracking-wider text-var">
            {playsPerDay} partidas al día · cuenta la mejor
          </p>
        )}
      </div>
      <p className="mt-6 text-sm font-bold uppercase tracking-wider text-var">Elige tu nivel</p>
      <p className="mt-1 text-sm text-muted">Cuanto más alto, más difíciles las preguntas y más puntos por acierto.</p>
      <div className="mt-4">
        <DifficultyPicker value={difficulty} onChange={onDifficulty} />
      </div>
      <button type="button" onClick={onStart} className="mt-6 w-full rounded-xl bg-var py-3.5 font-bold text-bg transition hover:brightness-110">
        Empezar
      </button>
    </div>
  );
}

function ScoreBar({
  q,
  score,
  modeName,
  level,
  endsAt,
  onTimeUp,
}: {
  q: PublicQuestion;
  score: number;
  modeName: string;
  level: string | null;
  endsAt: number | null;
  onTimeUp: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
        <span className="min-w-0 text-muted">
          <span className="text-[11px] uppercase tracking-[0.2em]">{modeName}</span>
          {level && <span className="text-[11px] uppercase tracking-[0.2em]"> · {level}</span>}
          <span className="mx-2 text-line">|</span>
          {q.total ? (
            <>
              Pregunta <span className="text-text">{q.position}</span>/{q.total}
            </>
          ) : (
            <>
              Pregunta <span className="text-text">{q.position}</span>
              <span className="ml-2 text-xs">· {q.confirmedCount} seguidas</span>
            </>
          )}
        </span>
        <span className="shrink-0 whitespace-nowrap font-display text-xl text-var">{score.toLocaleString("es-ES")} pts</span>
      </div>
      {q.total ? (
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: q.total }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < q.position - 1 ? "bg-var" : i === q.position - 1 ? "bg-text" : "bg-line"}`} />
          ))}
        </div>
      ) : endsAt ? (
        <GlobalClock endsAt={endsAt} onTimeUp={onTimeUp} />
      ) : null}
    </div>
  );
}

/** Contrarreloj: tiempo total de la partida. Lo decide el servidor; esto es solo visual. */
function GlobalClock({ endsAt, onTimeUp }: { endsAt: number; onTimeUp: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const cb = useRef(onTimeUp);
  useEffect(() => {
    cb.current = onTimeUp;
  }, [onTimeUp]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, endsAt - now);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      cb.current();
    }
  }, [left]);
  const s = Math.ceil(left / 1000);
  return (
    <p className={`mt-2 text-sm font-bold tabular-nums ${s <= 10 ? "text-ko" : "text-muted"}`} role="timer">
      Quedan {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")} de partida
    </p>
  );
}

/** Cuenta atrás visual de la pregunta. El tiempo real lo mide el servidor. */
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

function Clues({
  q,
  phase,
  text,
  onText,
  onClue,
  onSubmit,
}: {
  q: PublicQuestion;
  phase: Phase;
  text: string;
  onText: (t: string) => void;
  onClue: () => void;
  onSubmit: () => void;
}) {
  const v = phase.kind === "verdict" ? phase.v : null;
  const clues = q.clues ?? [];
  const used = q.cluesUsed ?? clues.length;
  const total = q.cluesTotal ?? clues.length;
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (phase.kind === "question") inputRef.current?.focus();
  }, [phase.kind, q.position]);
  return (
    <div className="mt-4">
      <ol className="space-y-2">
        {clues.map((c, i) => (
          <li key={i} className="flex animate-pop gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold">
            <span className="text-xs text-var">{String(i + 1).padStart(2, "0")}</span>
            {c}
          </li>
        ))}
      </ol>
      {phase.kind === "question" && phase.miss && (
        <p role="status" className="mt-3 animate-pop rounded-xl border border-ko bg-ko-bg px-4 py-3 text-sm font-semibold">
          No es «{phase.miss}». Te destapamos otra pista: sigue intentándolo.
        </p>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          Pista {used} de {total}
        </span>
        {phase.kind === "question" && used < total && (
          <button type="button" onClick={onClue} className="rounded-lg border border-line px-3 py-1.5 font-bold text-text hover:border-var">
            Pedir otra pista (menos bonus)
          </button>
        )}
      </div>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          ref={inputRef}
          value={v ? (v.choice ?? "") : text}
          onChange={(e) => onText(e.target.value)}
          disabled={phase.kind !== "question"}
          maxLength={80}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Nombre del jugador"
          aria-label="Nombre del jugador"
          className={`block w-full rounded-xl border-2 bg-bg px-4 py-3.5 text-lg font-bold outline-none transition focus:border-var ${
            v ? (v.isCorrect ? "border-var bg-ok-bg" : "border-ko bg-ko-bg") : "border-line"
          }`}
        />
      </form>
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
          {v.isHatTrick && (
            <p className="mt-2 inline-block rounded-md bg-bg px-3 py-1 text-sm font-extrabold text-var">Hat-trick · racha de {v.streak}</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-ko bg-ko-bg p-5 text-center">
          <p className="font-display text-4xl uppercase text-ko sm:text-5xl">Gol anulado</p>
          <p className="mt-1 font-semibold">
            {v.timedOut ? "Se acabó el tiempo." : "Anulado por poco."} Era <span className="text-var">{v.correctLabel}</span>.
          </p>
          {v.isLast && <p className="mt-2 text-sm text-muted">Fin de la partida.</p>}
        </div>
      )}
      {v.explanation && (
        <p className="mt-3 rounded-xl border border-line border-l-4 border-l-var bg-surface p-4 text-sm text-muted">
          <span className="font-bold text-text">Dato: </span>
          {v.explanation}
        </p>
      )}
      <button type="button" onClick={onNext} autoFocus className="mt-4 w-full rounded-xl bg-text py-3.5 font-bold text-bg hover:brightness-90">
        {v.isLast ? "Ver mi resultado" : "Siguiente pregunta"}
      </button>
    </div>
  );
}

function Summary({ s, onAgain, onChangeLevel }: { s: SessionSummary; onAgain?: () => void; onChangeLevel?: () => void }) {
  const isGuest = s.pendingPoints !== null;
  const info = modeBySlug(s.mode);
  const level = levelName(s.difficulty);
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-var">
        {s.mode === "daily" ? "Reto de hoy completado" : `${info.name}${level ? ` · ${level}` : ""} · partida terminada`}
      </p>
      <p className="mt-3 font-display text-7xl text-var text-glow">{s.score.toLocaleString("es-ES")}</p>
      <p className="font-display text-2xl uppercase">puntos</p>
      <p className="mt-4 text-muted">
        {s.correctCount} de {s.total ?? s.answered} goles confirmados
        {s.status === "abandoned" ? " (partida abandonada)" : ""}
      </p>
      {s.isBest && !isGuest && (
        <p className="mt-3 inline-block rounded-md bg-var px-3 py-1 text-sm font-extrabold uppercase text-bg">Tu mejor marca en este modo</p>
      )}
      {!s.isBest && s.bestScore != null && s.mode !== "league" && (
        <p className="mt-3 text-sm text-muted">Tu mejor marca: {s.bestScore.toLocaleString("es-ES")} pts</p>
      )}

      {isGuest ? (
        <div className="scanlines relative mt-8 overflow-hidden rounded-2xl border border-line bg-screen p-6">
          <Corners />
          <p className="relative font-display text-3xl uppercase">Regístrate y guarda estos puntos</p>
          <p className="relative mt-2 text-sm text-muted">
            Tienes {(s.pendingPoints ?? 0).toLocaleString("es-ES")} puntos pendientes. Con una cuenta gratis se suman a tu perfil y desbloqueas todos los juegos,
            rachas y ligas.
          </p>
          <Link href="/registro" className="relative mt-5 inline-block rounded-xl bg-var px-6 py-3.5 font-bold text-bg">
            Crear cuenta gratis
          </Link>
        </div>
      ) : s.mode === "daily" ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <p className="font-display text-3xl uppercase">
            Racha: <span className="text-var">{s.streak ?? 0} {s.streak === 1 ? "día" : "días"}</span>
          </p>
          <p className="mt-2 text-sm text-muted">Mañana hay reto nuevo. No pierdas la racha.</p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {s.leagueId && (
          <Link href={`/ligas/${s.leagueId}`} className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg hover:brightness-110">
            Ver la clasificación
          </Link>
        )}
        {onAgain && (
          <button type="button" onClick={onAgain} className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg hover:brightness-110">
            Jugar otra vez
          </button>
        )}
        {onChangeLevel && (
          <button type="button" onClick={onChangeLevel} className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold hover:border-var">
            Cambiar nivel
          </button>
        )}
        <Link href="/jugar" className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold hover:border-var">
          Otros juegos
        </Link>
      </div>
    </div>
  );
}
