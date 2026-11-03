import { describe, expect, it } from "vitest";
import { answerSchema, normalizeAnswer, startGameSchema } from "./schemas";

describe("startGameSchema", () => {
  it("acepta un modo válido", () => {
    expect(startGameSchema.parse({ mode: "daily" })).toEqual({ mode: "daily" });
  });
  it("rechaza un modo inventado", () => {
    expect(startGameSchema.safeParse({ mode: "trampa" }).success).toBe(false);
  });
});

describe("answerSchema", () => {
  it("acepta una opción", () => {
    expect(answerSchema.safeParse({ position: 1, optionId: "abc" }).success).toBe(true);
  });
  it("rechaza opción y texto a la vez", () => {
    expect(answerSchema.safeParse({ position: 1, optionId: "abc", text: "Figo" }).success).toBe(false);
  });
  it("rechaza respuesta vacía", () => {
    expect(answerSchema.safeParse({ position: 1 }).success).toBe(false);
  });
});

describe("normalizeAnswer", () => {
  it("quita tildes, mayúsculas y signos", () => {
    expect(normalizeAnswer("  Luís  FIGO! ")).toBe("luis figo");
    expect(normalizeAnswer("Modrić")).toBe("modric");
    expect(normalizeAnswer("Kun Agüero")).toBe("kun aguero");
  });
});
