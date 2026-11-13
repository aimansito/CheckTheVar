/** Tipos compartidos entre la web, la app móvil y el servidor. */

export const GAME_MODES = [
  "daily",
  "grid",
  "guess-player",
  "career-path",
  "higher-lower",
  "time-attack",
  "survival",
  "retro",
  "league",
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
  mode: GameModeSlug;
  difficulty: string | null;
  position: number;
  /** Nº de preguntas de la partida (null = sin límite: supervivencia, contrarreloj). */
  total: number | null;
  format: "multiple_choice" | "free_text" | "true_false";
  prompt: string;
  category: string;
  /** Opciones barajadas por sesión en el servidor (vacío en texto libre). */
  options: { id: string; label: string }[];
  /** Tiempo límite en ms (lo mide el servidor, esto es solo para la cuenta atrás visual). */
  timeLimitMs: number;
  /** Tiempo ya transcurrido desde que el servidor la mostró (al recargar, el reloj no se reinicia). */
  elapsedMs: number;
  /** Contrarreloj: ms que quedan de partida. */
  endsInMs: number | null;
  sessionScore: number;
  /** Goles confirmados en la partida hasta ahora (supervivencia: aciertos seguidos). */
  confirmedCount: number;
  /** Texto libre: pistas reveladas hasta ahora. */
  clues: string[] | null;
  cluesUsed: number | null;
  cluesTotal: number | null;
};

/** Estado de una partida al empezarla o retomarla. */
export type GameStart = {
  sessionId: string;
  mode: GameModeSlug;
  /** Nivel de la partida (null en el reto diario: igual para todos). */
  difficulty?: string | null;
  total: number | null;
  status: "started" | "finished" | "abandoned";
  score: number;
  correctCount: number;
  answered: number;
  endsInMs?: number | null;
  /** true si ya existía (el reto diario no se puede reiniciar). */
  resumed: boolean;
};

/** Respuesta del servidor DESPUÉS de CHECK THE VAR. */
export type VarVerdict = {
  position: number;
  /** Opción elegida por el jugador (letra) o texto escrito. */
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
  /** La partida ha terminado con esta respuesta (última pregunta, fallo en supervivencia, tiempo). */
  isLast: boolean;
};

/**
 * Respuesta escrita incorrecta con pistas pendientes: la pregunta sigue abierta y se destapa
 * la siguiente pista (no se revela la respuesta).
 */
export type ClueRetry = {
  retry: true;
  position: number;
  answerText: string | null;
  clues: string[];
  cluesUsed: number;
  cluesTotal: number;
};

/** Pistas tras pedir una más. */
export type ClueReveal = {
  position: number;
  clues: string[];
  cluesUsed: number;
  cluesTotal: number;
};

export type SessionSummary = {
  sessionId: string;
  mode: GameModeSlug;
  difficulty: string | null;
  /** Partida de jornada de liga: liga a la que volver. */
  leagueId: number | null;
  status: "started" | "finished" | "abandoned";
  score: number;
  correctCount: number;
  total: number | null;
  answered: number;
  /** Solo invitados: puntos pendientes de guardar al registrarse. */
  pendingPoints: number | null;
  /** Solo registrados: días seguidos jugando el reto diario. */
  streak: number | null;
  /** Solo registrados: mejor puntuación en este modo (incluida esta partida). */
  bestScore: number | null;
  /** Esta partida iguala o supera su mejor marca. */
  isBest: boolean;
};

/** Códigos de error de la API de partida (el texto para el usuario lo pone la UI). */
export type GameErrorCode =
  | "invalid_input"
  | "account_required"
  | "premium_required"
  | "mode_not_available"
  | "session_not_found"
  | "question_not_shown"
  | "session_closed"
  | "invalid_choice"
  | "no_questions"
  | "rate_limited"
  | "already_played"
  | "daily_limit"
  | "matchday_closed"
  | "not_member"
  | "server_error";
