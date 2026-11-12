/**
 * Puntuación de CHECK THE VAR.
 * ÚNICO sitio donde viven los valores de puntuación: no repetirlos en otra parte del código.
 * Lo usa el SERVIDOR al corregir; la UI solo muestra los puntos que devuelve el servidor.
 */

export const SCORING = {
  /** Puntos por acierto. */
  basePoints: 100,
  /** Bonus máximo por rapidez (lineal según el tiempo restante). */
  maxSpeedBonus: 50,
  /** Tiempo por pregunta en milisegundos. */
  questionTimeMs: 20_000,
  /** Margen de red tolerado antes de considerar la respuesta fuera de tiempo. */
  networkGraceMs: 1_000,
  /** Aciertos seguidos necesarios para un hat-trick. */
  hatTrickStreak: 3,
  /** Bonus por cada hat-trick. */
  hatTrickBonus: 50,
} as const;

export type ScoringConfig = { [K in keyof typeof SCORING]: number };

export type AnswerScoreInput = {
  isCorrect: boolean;
  /** answered_at - shown_at, medido en el servidor. */
  elapsedMs: number;
  /** Aciertos seguidos ANTES de esta respuesta. */
  streakBefore: number;
};

export type AnswerScore = {
  /** Fuera de tiempo (cuenta como fallo). */
  timedOut: boolean;
  /** Acierto efectivo: correcto y dentro de tiempo. */
  counted: boolean;
  base: number;
  speedBonus: number;
  hatTrickBonus: number;
  total: number;
  streakAfter: number;
  /** true si esta respuesta completa un hat-trick (3, 6, 9… seguidos). */
  isHatTrick: boolean;
};

/** Calcula los puntos de una respuesta. Función pura: misma entrada, misma salida. */
export function scoreAnswer(input: AnswerScoreInput, config: ScoringConfig = SCORING): AnswerScore {
  const elapsed = Math.max(0, input.elapsedMs);
  const timedOut = elapsed > config.questionTimeMs + config.networkGraceMs;
  const counted = input.isCorrect && !timedOut;

  if (!counted) {
    return {
      timedOut,
      counted: false,
      base: 0,
      speedBonus: 0,
      hatTrickBonus: 0,
      total: 0,
      streakAfter: 0,
      isHatTrick: false,
    };
  }

  // Dentro del margen de red, el tiempo restante se considera 0 (sin bonus, pero acierto válido).
  const remainingMs = Math.max(0, config.questionTimeMs - elapsed);
  const speedBonus = Math.round((remainingMs / config.questionTimeMs) * config.maxSpeedBonus);

  const streakAfter = Math.max(0, input.streakBefore) + 1;
  const isHatTrick = streakAfter % config.hatTrickStreak === 0;
  const hatTrickBonus = isHatTrick ? config.hatTrickBonus : 0;

  const base = config.basePoints;
  return {
    timedOut: false,
    counted: true,
    base,
    speedBonus,
    hatTrickBonus,
    total: base + speedBonus + hatTrickBonus,
    streakAfter,
    isHatTrick,
  };
}

/** Puntuación de las preguntas con pistas (adivina el jugador, trayectoria). */
export const CLUE_SCORING = {
  /** Bonus máximo por acertar con la primera pista; baja linealmente hasta 0 con la última. */
  maxClueBonus: 100,
} as const;

export type ClueScoreInput = AnswerScoreInput & {
  /** Pistas vistas al responder (mínimo 1). */
  cluesUsed: number;
  cluesTotal: number;
};

/** Puntos de una pregunta con pistas: base + bonus por pistas no usadas + hat-trick. Sin bonus de rapidez. */
export function scoreClueAnswer(input: ClueScoreInput, config: ScoringConfig = SCORING): AnswerScore {
  const base = scoreAnswer(input, config);
  if (!base.counted) return base;
  const unused = Math.max(0, input.cluesTotal - Math.max(1, input.cluesUsed));
  const span = Math.max(1, input.cluesTotal - 1);
  const clueBonus = Math.round((unused / span) * CLUE_SCORING.maxClueBonus);
  return {
    ...base,
    speedBonus: clueBonus,
    total: base.base + clueBonus + base.hatTrickBonus,
  };
}

/**
 * Reglas de cada modo de juego. ÚNICO sitio donde se definen: el servidor las pasa
 * a la base de datos al empezar la partida y la UI solo las muestra.
 */
export type ModeRule = {
  /** Nombre en español. */
  name: string;
  /** Bolsa de preguntas de la que se sirve. */
  kind: "quiz" | "higher_lower" | "guess_player" | "career_path";
  /** Nº de preguntas por partida (null = sin límite). */
  questions: number | null;
  /** Tiempo por pregunta en ms. */
  questionTimeMs: number;
  /** Duración total de la partida en ms (contrarreloj) o null. */
  durationMs: number | null;
  /** La partida termina al primer fallo. */
  endsOnMiss: boolean;
  /** Preguntas con pistas progresivas y respuesta escrita. */
  clues: boolean;
  /** Disponible para jugar. */
  available: boolean;
};

export const MODE_RULES = {
  daily: { name: "Reto diario", kind: "quiz", questions: 10, questionTimeMs: 20_000, durationMs: null, endsOnMiss: false, clues: false, available: true },
  survival: { name: "Supervivencia", kind: "quiz", questions: null, questionTimeMs: 15_000, durationMs: null, endsOnMiss: true, clues: false, available: true },
  "time-attack": { name: "Contrarreloj", kind: "quiz", questions: null, questionTimeMs: 10_000, durationMs: 90_000, endsOnMiss: false, clues: false, available: true },
  "higher-lower": { name: "Más o menos", kind: "higher_lower", questions: null, questionTimeMs: 15_000, durationMs: null, endsOnMiss: true, clues: false, available: true },
  "guess-player": { name: "Adivina el jugador", kind: "guess_player", questions: 5, questionTimeMs: 90_000, durationMs: null, endsOnMiss: false, clues: true, available: true },
  "career-path": { name: "Trayectoria", kind: "career_path", questions: 5, questionTimeMs: 90_000, durationMs: null, endsOnMiss: false, clues: true, available: true },
  grid: { name: "Grid", kind: "quiz", questions: 9, questionTimeMs: 60_000, durationMs: null, endsOnMiss: false, clues: false, available: false },
  league: { name: "Jornada de liga", kind: "quiz", questions: 10, questionTimeMs: 20_000, durationMs: null, endsOnMiss: false, clues: false, available: true },
} as const satisfies Record<string, ModeRule>;

export type ModeSlug = keyof typeof MODE_RULES;

/**
 * Niveles de dificultad. Cada uno sirve preguntas de un rango de dificultad (1–5) que se
 * solapa con el siguiente: dentro de un nivel hay preguntas más fáciles y más difíciles.
 * Los puntos se multiplican para que jugar en un nivel alto compense en ligas y marcas.
 */
export const DIFFICULTY_LEVELS = {
  normal: { name: "Normal", min: 1, max: 2, multiplier: 1, oldEra: false, hint: "Lo que sabe cualquiera que vea fútbol." },
  aficionado: { name: "Aficionado", min: 1, max: 3, multiplier: 1.2, oldEra: false, hint: "Ves los partidos y te sabes las finales." },
  estrella: { name: "Estrella", min: 2, max: 4, multiplier: 1.4, oldEra: false, hint: "Goleadores, fichajes y premios de cada año." },
  leyenda: { name: "Leyenda", min: 3, max: 5, multiplier: 1.7, oldEra: false, hint: "Datos que solo recuerdan los muy futboleros." },
  historico: { name: "Histórico", min: 4, max: 5, multiplier: 2, oldEra: true, hint: "Lo más difícil, con mucho fútbol de antes de 1990." },
} as const;

export type DifficultyLevel = keyof typeof DIFFICULTY_LEVELS;
export const DIFFICULTY_SLUGS = Object.keys(DIFFICULTY_LEVELS) as DifficultyLevel[];
export const DEFAULT_DIFFICULTY: DifficultyLevel = "aficionado";

/** Aplica el multiplicador del nivel a los puntos de una respuesta. */
export function applyDifficulty(score: AnswerScore, level: DifficultyLevel): AnswerScore {
  const m = DIFFICULTY_LEVELS[level].multiplier;
  if (!score.counted || m === 1) return score;
  return { ...score, total: Math.round(score.total * m) };
}

/** Configuración de puntuación de un modo (solo cambia el tiempo por pregunta). */
export function scoringFor(mode: ModeSlug): ScoringConfig {
  return { ...SCORING, questionTimeMs: MODE_RULES[mode].questionTimeMs };
}

/** Puntuación máxima posible en una partida de n preguntas (útil para validaciones y tests). */
export function maxSessionScore(questionCount: number, config: ScoringConfig = SCORING): number {
  const hatTricks = Math.floor(questionCount / config.hatTrickStreak);
  return questionCount * (config.basePoints + config.maxSpeedBonus) + hatTricks * config.hatTrickBonus;
}
