import "server-only";
import {
  GUEST_MODES,
  SCORING,
  scoreAnswer,
  type AnswerInput,
  type GameErrorCode,
  type GameStart,
  type PublicQuestion,
  type SessionSummary,
  type StartGameInput,
  type VarVerdict,
} from "@checkthevar/shared";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Player } from "./player";

/**
 * Lógica de partida en el servidor. La BD (funciones game_*) guarda y corrige;
 * aquí se calculan los puntos con scoring.ts, la única fuente de los valores.
 */

export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    public readonly status: number,
  ) {
    super(code);
  }
}

const SQL_ERRORS: Record<string, [GameErrorCode, number]> = {
  session_not_found: ["session_not_found", 404],
  question_not_shown: ["question_not_shown", 409],
  session_closed: ["session_closed", 409],
  invalid_choice: ["invalid_choice", 400],
  no_questions: ["no_questions", 503],
  player_required: ["account_required", 401],
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseAdmin().rpc(fn, args);
  if (error) {
    const known = SQL_ERRORS[error.message];
    if (known) throw new GameError(known[0], known[1]);
    console.error(`[game] ${fn} falló:`, error.message);
    throw new GameError("server_error", 500);
  }
  return data as T;
}

const who = (p: Player) => ({ p_user: p.userId, p_guest: p.guestId });

export async function startGame(input: StartGameInput, player: Player): Promise<GameStart> {
  if (player.kind === "guest" && !GUEST_MODES.includes(input.mode)) {
    throw new GameError("account_required", 401);
  }
  if (input.mode !== "daily") {
    // De momento solo está implementado el reto diario.
    throw new GameError("mode_not_available", 501);
  }
  return rpc<GameStart>("game_start_daily", who(player));
}

type SqlNext =
  | { done: true; status: string }
  | (Omit<PublicQuestion, "timeLimitMs"> & { done: false });

export async function nextQuestion(
  sessionId: string,
  player: Player,
): Promise<PublicQuestion | { done: true }> {
  const r = await rpc<SqlNext>("game_next", { p_session: sessionId, ...who(player), p_lang: "es" });
  if (r.done) return { done: true };
  const { done: _done, ...question } = r;
  void _done;
  return { ...question, timeLimitMs: SCORING.questionTimeMs };
}

type SqlSubmit = {
  alreadyAnswered: boolean;
  scored: boolean;
  position: number;
  total: number;
  isLast: boolean;
  choice: string | null;
  rawCorrect: boolean;
  isCorrect?: boolean | null;
  points?: number;
  elapsedMs: number;
  streakBefore: number;
  correctOptionId: string;
  correctLabel: string;
  explanation: string | null;
  sessionScore: number;
};

type SqlRecord = { sessionScore: number; correctCount: number; status: string; total: number };

/** CHECK THE VAR. Idempotente: repetir la misma posición devuelve el mismo veredicto. */
export async function submitAnswer(
  sessionId: string,
  player: Player,
  input: AnswerInput,
): Promise<VarVerdict> {
  if (input.text !== undefined) {
    throw new GameError("invalid_choice", 400); // el reto diario es solo tipo test
  }
  const sub = await rpc<SqlSubmit>("game_submit", {
    p_session: sessionId,
    ...who(player),
    p_position: input.position,
    p_choice: input.timeout ? null : input.optionId,
    p_lang: "es",
  });

  const score = scoreAnswer({
    isCorrect: sub.rawCorrect,
    elapsedMs: sub.elapsedMs,
    streakBefore: sub.streakBefore,
  });

  let sessionScore = sub.sessionScore;
  if (!sub.scored) {
    const rec = await rpc<SqlRecord>("game_record_score", {
      p_session: sessionId,
      ...who(player),
      p_position: input.position,
      p_counted: score.counted,
      p_points: score.total,
      p_elapsed_ms: Math.max(0, Math.round(sub.elapsedMs)),
    });
    sessionScore = rec.sessionScore;
  }

  // Si ya estaba puntuada, se devuelve lo guardado (no se recalcula).
  const isCorrect = sub.scored ? Boolean(sub.isCorrect) : score.counted;
  const points = sub.scored ? (sub.points ?? 0) : score.total;

  return {
    position: sub.position,
    choice: sub.choice,
    isCorrect,
    timedOut: score.timedOut,
    correctOptionId: sub.correctOptionId,
    correctLabel: sub.correctLabel,
    explanation: sub.explanation,
    points,
    isHatTrick: isCorrect && score.isHatTrick,
    streak: isCorrect ? score.streakAfter : 0,
    sessionScore,
    isLast: sub.isLast,
  };
}

export async function getSummary(sessionId: string, player: Player): Promise<SessionSummary> {
  return rpc<SessionSummary>("game_summary", { p_session: sessionId, ...who(player) });
}
