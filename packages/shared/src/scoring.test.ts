import { describe, expect, it } from "vitest";
import { SCORING, maxSessionScore, scoreAnswer } from "./scoring";

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

describe("maxSessionScore", () => {
  it("reto diario de 10 preguntas: 10 × 150 + 3 hat-tricks", () => {
    expect(maxSessionScore(10)).toBe(1650);
  });
});
