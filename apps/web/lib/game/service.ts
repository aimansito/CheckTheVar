import "server-only";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_LEVELS,
  GUEST_MODES,
  MODE_RULES,
  applyDifficulty,
  normalizeAnswer,
  scoreAnswer,
  scoreClueAnswer,
  scoringFor,
  type AnswerInput,
  type DifficultyLevel,
  type ClueReveal,
  type ClueRetry,
  type GameErrorCode,
  type GameModeSlug,
  type GameStart,
  type PublicQuestion,
  type SessionSummary,
  type StartGameInput,
  type VarVerdict,
} from "@checkthevar/shared";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Player } from "./player";

/**
 * Lógica de partida en el servidor, común a todos los modos. La BD (funciones game_*)
 * guarda y corrige; aquí se aplican las reglas de MODE_RULES y se calculan los puntos
 * con scoring.ts, la única fuente de los valores.
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
  account_required: ["account_required", 401],
  premium_required: ["premium_required", 403],
  mode_not_available: ["mode_not_available", 404],
  not_member: ["not_member", 403],
  matchday_closed: ["matchday_closed", 409],
  invalid_input: ["invalid_input", 400],
  daily_limit: ["daily_limit", 429],
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

/** Nivel por defecto del jugador (el de su perfil). */
async function profileDifficulty(userId: string): Promise<DifficultyLevel> {
  const { data } = await getSupabaseAdmin().from("users").select("difficulty").eq("id", userId).maybeSingle();
  const d = data?.difficulty as string | undefined;
  return d && d in DIFFICULTY_LEVELS ? (d as DifficultyLevel) : DEFAULT_DIFFICULTY;
}

export async function startGame(input: StartGameInput, player: Player): Promise<GameStart> {
  if (player.kind === "guest" && !GUEST_MODES.includes(input.mode)) {
    throw new GameError("account_required", 401);
  }
  const rule = MODE_RULES[input.mode];
  if (!rule.available) throw new GameError("mode_not_available", 404);

  if (input.mode === "league") {
    if (!input.matchdayId || player.kind !== "user") throw new GameError("invalid_input", 400);
    return rpc<GameStart>("game_start_league", { p_user: player.userId, p_matchday: input.matchdayId });
  }
  if (input.mode === "daily") {
    // El reto diario es igual para todos: sin nivel.
    return rpc<GameStart>("game_start", {
      ...who(player), p_mode: "daily", p_kind: rule.kind, p_total: rule.questions, p_duration_ms: null,
      p_level: null, p_min: null, p_max: null, p_old: false, p_plays_per_day: null,
    });
  }

  const level = input.difficulty ?? (player.kind === "user" ? await profileDifficulty(player.userId) : DEFAULT_DIFFICULTY);
  const d = DIFFICULTY_LEVELS[level];
  return rpc<GameStart>("game_start", {
    ...who(player),
    p_mode: input.mode,
    p_kind: rule.kind,
    p_total: rule.questions,
    p_duration_ms: rule.durationMs,
    p_level: level,
    p_min: d.min,
    p_max: d.max,
    p_old: d.oldEra,
    p_plays_per_day: rule.playsPerDay,
  });
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
  const rule = MODE_RULES[question.mode as GameModeSlug] ?? MODE_RULES.daily;
  return { ...question, timeLimitMs: rule.questionTimeMs };
}

export async function revealClue(sessionId: string, player: Player, position: number): Promise<ClueReveal> {
  return rpc<ClueReveal>("game_clue", { p_session: sessionId, ...who(player), p_position: position, p_lang: "es" });
}

type SqlSubmit = {
  alreadyAnswered: boolean;
  scored: boolean;
  mode: GameModeSlug;
  difficulty: DifficultyLevel | null;
  position: number;
  total: number | null;
  format: "multiple_choice" | "free_text" | "true_false";
  choice: string | null;
  answerText: string | null;
  rawCorrect: boolean;
  isCorrect?: boolean | null;
  points?: number;
  elapsedMs: number;
  cluesUsed: number;
  cluesTotal: number;
  streakBefore: number;
  correctOptionId: string | null;
  correctLabel: string;
  explanation: string | null;
  sessionScore: number;
  status: "started" | "finished" | "abandoned";
};

type SqlRecord = { sessionScore: number; correctCount: number; status: string; total: number | null };

/** CHECK THE VAR. Idempotente: repetir la misma posición devuelve el mismo veredicto. */
export async function submitAnswer(
  sessionId: string,
  player: Player,
  input: AnswerInput,
): Promise<VarVerdict | ClueRetry> {
  const res = await rpc<SqlSubmit | ClueRetry>("game_submit", {
    p_session: sessionId,
    ...who(player),
    p_position: input.position,
    p_choice: input.timeout || input.text !== undefined ? null : input.optionId,
    p_text: input.timeout || input.text === undefined ? null : normalizeAnswer(input.text),
    p_lang: "es",
  });
  // Fallo con pistas pendientes: no se puntúa todavía, sigue la misma pregunta.
  if ("retry" in res) return res;
  const sub = res;

  const mode: GameModeSlug = sub.mode in MODE_RULES ? sub.mode : "daily";
  const rule = MODE_RULES[mode];
  const base = { isCorrect: sub.rawCorrect, elapsedMs: sub.elapsedMs, streakBefore: sub.streakBefore };
  const raw =
    sub.format === "free_text" && sub.cluesTotal > 0
      ? scoreClueAnswer({ ...base, cluesUsed: sub.cluesUsed, cluesTotal: sub.cluesTotal }, scoringFor(mode))
      : scoreAnswer(base, scoringFor(mode));
  // Más puntos cuanto más alto el nivel (el reto diario no tiene nivel: multiplicador 1).
  const score = sub.difficulty && sub.difficulty in DIFFICULTY_LEVELS ? applyDifficulty(raw, sub.difficulty) : raw;

  let sessionScore = sub.sessionScore;
  let status = sub.status;
  if (!sub.scored) {
    const rec = await rpc<SqlRecord>("game_record_score", {
      p_session: sessionId,
      ...who(player),
      p_position: input.position,
      p_counted: score.counted,
      p_points: score.total,
      p_elapsed_ms: Math.max(0, Math.round(sub.elapsedMs)),
      p_finish: rule.endsOnMiss && !score.counted,
    });
    sessionScore = rec.sessionScore;
    status = rec.status as SqlSubmit["status"];
  }

  // Si ya estaba puntuada, se devuelve lo guardado (no se recalcula).
  const isCorrect = sub.scored ? Boolean(sub.isCorrect) : score.counted;
  const points = sub.scored ? (sub.points ?? 0) : score.total;

  return {
    position: sub.position,
    choice: sub.format === "free_text" ? sub.answerText : sub.choice,
    isCorrect,
    timedOut: score.timedOut,
    correctOptionId: sub.correctOptionId,
    correctLabel: sub.correctLabel,
    explanation: sub.explanation,
    points,
    isHatTrick: isCorrect && score.isHatTrick,
    streak: isCorrect ? score.streakAfter : 0,
    sessionScore,
    isLast: status !== "started",
  };
}

export async function getSummary(sessionId: string, player: Player): Promise<SessionSummary> {
  return rpc<SessionSummary>("game_summary", { p_session: sessionId, ...who(player) });
}

export async function abandonGame(sessionId: string, player: Player): Promise<SessionSummary> {
  return rpc<SessionSummary>("game_abandon", { p_session: sessionId, ...who(player) });
}
