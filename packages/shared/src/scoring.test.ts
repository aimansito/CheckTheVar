import { describe, expect, it } from "vitest";
import { CLUE_SCORING, DIFFICULTY_LEVELS, MODE_RULES, SCORING, applyDifficulty, maxSessionScore, scoreAnswer, scoreClueAnswer, scoringFor } from "./scoring";

describe("scoreAnswer", () => {
  it("acierto instantáneo: base + bonus máximo", () => {
    const r = scoreAnswer({ isCorrect: true, elapsedMs: 0, streakBefore: 0 });
    expect(r.total).toBe(150);
    expect(r.speedBonus).toBe(50);
    expect(r.streakAfter).toBe(1);
  });

  it("bonus por rapidez lineal: a mitad de tiempo, 25", () => {
    const r = scoreAnswer({ isCorrect: true, elapsedMs: 10_000, streakBefore: 0 });
    expect(r.speedBonus).toBe(25);
    expect(r.total).toBe(125);
  });

  it("acierto justo al final: solo la base", () => {
    const r = scoreAnswer({ isCorrect: true, elapsedMs: 20_000, streakBefore: 0 });
    expect(r.total).toBe(100);
  });

  it("dentro del margen de red: acierto válido sin bonus", () => {
    const r = scoreAnswer({ isCorrect: true, elapsedMs: 20_800, streakBefore: 0 });
    expect(r.counted).toBe(true);
    expect(r.total).toBe(100);
  });

  it("respuesta tardía: cuenta como fallo y rompe la racha", () => {
    const r = scoreAnswer({ isCorrect: true, elapsedMs: 21_001, streakBefore: 2 });
    expect(r.timedOut).toBe(true);
    expect(r.total).toBe(0);
    expect(r.streakAfter).toBe(0);
  });

  it("fallo: 0 puntos y racha a 0", () => {
    const r = scoreAnswer({ isCorrect: false, elapsedMs: 1_000, streakBefore: 5 });
    expect(r.total).toBe(0);
    expect(r.streakAfter).toBe(0);
  });

  it("hat-trick al tercer acierto seguido: +50", () => {
    const r = scoreAnswer({ isCorrect: true, elapsedMs: 20_000, streakBefore: 2 });
    expect(r.isHatTrick).toBe(true);
    expect(r.hatTrickBonus).toBe(SCORING.hatTrickBonus);
    expect(r.total).toBe(150);
  });

  it("hat-trick se repite cada 3 (6.º acierto) pero no en el 4.º", () => {
    expect(scoreAnswer({ isCorrect: true, elapsedMs: 0, streakBefore: 3 }).isHatTrick).toBe(false);
    expect(scoreAnswer({ isCorrect: true, elapsedMs: 0, streakBefore: 5 }).isHatTrick).toBe(true);
  });

  it("tiempos negativos (reloj raro) no dan más del máximo", () => {
    const r = scoreAnswer({ isCorrect: true, elapsedMs: -500, streakBefore: 0 });
    expect(r.speedBonus).toBe(SCORING.maxSpeedBonus);
  });
});

describe("scoreClueAnswer (adivina el jugador / trayectoria)", () => {
  const cfg = scoringFor("guess-player");

  it("acierto con la primera pista: base + bonus máximo de pistas, sin bonus de rapidez", () => {
    const r = scoreClueAnswer({ isCorrect: true, elapsedMs: 30_000, streakBefore: 0, cluesUsed: 1, cluesTotal: 5 }, cfg);
    expect(r.total).toBe(100 + CLUE_SCORING.maxClueBonus);
  });

  it("bonus lineal: a mitad de pistas, la mitad; con todas, solo la base", () => {
    expect(scoreClueAnswer({ isCorrect: true, elapsedMs: 0, streakBefore: 0, cluesUsed: 3, cluesTotal: 5 }, cfg).total).toBe(150);
    expect(scoreClueAnswer({ isCorrect: true, elapsedMs: 0, streakBefore: 0, cluesUsed: 5, cluesTotal: 5 }, cfg).total).toBe(100);
  });

  it("respeta el tiempo del modo (90 s) y el hat-trick", () => {
    expect(scoreClueAnswer({ isCorrect: true, elapsedMs: 80_000, streakBefore: 0, cluesUsed: 5, cluesTotal: 5 }, cfg).counted).toBe(true);
    expect(scoreClueAnswer({ isCorrect: true, elapsedMs: 92_000, streakBefore: 0, cluesUsed: 1, cluesTotal: 5 }, cfg).timedOut).toBe(true);
    expect(scoreClueAnswer({ isCorrect: true, elapsedMs: 0, streakBefore: 2, cluesUsed: 5, cluesTotal: 5 }, cfg).total).toBe(150);
  });

  it("fallo: 0", () => {
    expect(scoreClueAnswer({ isCorrect: false, elapsedMs: 0, streakBefore: 0, cluesUsed: 1, cluesTotal: 5 }, cfg).total).toBe(0);
  });
});

describe("MODE_RULES", () => {
  it("contrarreloj: 10 s por pregunta; el bonus se calcula sobre ese tiempo", () => {
    const r = scoreAnswer({ isCorrect: true, elapsedMs: 5_000, streakBefore: 0 }, scoringFor("time-attack"));
    expect(r.speedBonus).toBe(25);
    expect(scoreAnswer({ isCorrect: true, elapsedMs: 11_500, streakBefore: 0 }, scoringFor("time-attack")).timedOut).toBe(true);
  });

  it("los modos de un fallo y los de pistas están marcados", () => {
    expect(MODE_RULES.survival.endsOnMiss).toBe(true);
    expect(MODE_RULES["higher-lower"].endsOnMiss).toBe(true);
    expect(MODE_RULES["guess-player"].clues).toBe(true);
    expect(MODE_RULES.daily.questions).toBe(10);
  });
});

describe("maxSessionScore", () => {
  it("reto diario de 10 preguntas: 10 × 150 + 3 hat-tricks", () => {
    expect(maxSessionScore(10)).toBe(1650);
  });
});

describe("DIFFICULTY_LEVELS", () => {
  it("los rangos se solapan y suben de nivel en nivel", () => {
    const levels = Object.values(DIFFICULTY_LEVELS);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!.min).toBeGreaterThanOrEqual(levels[i - 1]!.min);
      expect(levels[i]!.max).toBeGreaterThanOrEqual(levels[i - 1]!.max);
      expect(levels[i]!.multiplier).toBeGreaterThan(levels[i - 1]!.multiplier);
    }
  });

  it("el multiplicador solo se aplica a los aciertos", () => {
    const hit = scoreAnswer({ isCorrect: true, elapsedMs: 0, streakBefore: 0 });
    expect(applyDifficulty(hit, "historico").total).toBe(300);
    expect(applyDifficulty(hit, "normal").total).toBe(150);
    const miss = scoreAnswer({ isCorrect: false, elapsedMs: 0, streakBefore: 0 });
    expect(applyDifficulty(miss, "historico").total).toBe(0);
  });

  it("la puntuación máxima por respuesta cabe en el límite del servidor (1000)", () => {
    const best = scoreClueAnswer({ isCorrect: true, elapsedMs: 0, streakBefore: 2, cluesUsed: 1, cluesTotal: 5 });
    expect(applyDifficulty(best, "historico").total).toBeLessThanOrEqual(1000);
  });
});
