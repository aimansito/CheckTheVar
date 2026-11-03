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

/** Puntuación máxima posible en una partida de n preguntas (útil para validaciones y tests). */
export function maxSessionScore(questionCount: number, config: ScoringConfig = SCORING): number {
  const hatTricks = Math.floor(questionCount / config.hatTrickStreak);
  return questionCount * (config.basePoints + config.maxSpeedBonus) + hatTricks * config.hatTrickBonus;
}
