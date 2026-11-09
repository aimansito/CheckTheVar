/** Tipos compartidos entre la web, la app móvil y el servidor. */

export const GAME_MODES = [
  "daily",
  "grid",
  "guess-player",
  "career-path",
  "higher-lower",
  "time-attack",
  "survival",
] as const;
export type GameModeSlug = (typeof GAME_MODES)[number];

/** Modos que un invitado puede jugar (1 al día). */
export const GUEST_MODES: readonly GameModeSlug[] = ["daily"];

export const DAILY_QUESTION_COUNT = 10;

export type Language = "es" | "en" | "pt" | "ar";

/**
 * Pregunta tal y como se envía al CLIENTE antes de pulsar CHECK THE VAR.
 * Nunca incluye is_correct ni respuestas aceptadas.
 */
export type PublicQuestion = {
  sessionId: string;
  position: number;
  total: number;
  format: "multiple_choice" | "free_text" | "true_false";
  prompt: string;
  category: string;
  /** Opciones barajadas por sesión en el servidor. */
  options: { id: string; label: string }[];
  /** Tiempo límite en ms (lo mide el servidor, esto es solo para la cuenta atrás visual). */
  timeLimitMs: number;
  /** Tiempo ya transcurrido desde que el servidor la mostró (al recargar, el reloj no se reinicia). */
  elapsedMs: number;
};

/** Estado de una partida al empezarla o retomarla. */
export type GameStart = {
  sessionId: string;
  mode: GameModeSlug;
  total: number;
  status: "started" | "finished" | "abandoned";
  score: number;
  correctCount: number;
  answered: number;
  /** true si ya existía (el reto diario no se puede reiniciar). */
  resumed: boolean;
};

/** Respuesta del servidor DESPUÉS de CHECK THE VAR. */
export type VarVerdict = {
  position: number;
  /** Opción elegida por el jugador (letra). */
  choice: string | null;
  /** GOL CONFIRMADO (true) / GOL ANULADO (false). */
  isCorrect: boolean;
  timedOut: boolean;
  correctOptionId: string | null;
  correctLabel: string;
  explanation: string | null;
  points: number;
  isHatTrick: boolean;
  streak: number;
  sessionScore: number;
  isLast: boolean;
};

export type SessionSummary = {
  sessionId: string;
  mode: GameModeSlug;
  status: "started" | "finished" | "abandoned";
  score: number;
  correctCount: number;
  total: number;
  /** Solo invitados: puntos pendientes de guardar al registrarse. */
  pendingPoints: number | null;
  /** Solo registrados: días seguidos jugando el reto diario. */
  streak: number | null;
};

/** Códigos de error de la API de partida (el texto para el usuario lo pone la UI). */
export type GameErrorCode =
  | "invalid_input"
  | "account_required"
  | "mode_not_available"
  | "session_not_found"
  | "question_not_shown"
  | "session_closed"
  | "invalid_choice"
  | "no_questions"
  | "server_error";
