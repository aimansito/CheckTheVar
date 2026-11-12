import { describe, expect, it } from "vitest";
import { answerSchema, normalizeAnswer, signUpSchema, startGameSchema } from "./schemas";

describe("startGameSchema", () => {
  it("acepta un modo válido", () => {
    expect(startGameSchema.parse({ mode: "daily" })).toEqual({ mode: "daily" });
  });
  it("rechaza un modo inventado", () => {
    expect(startGameSchema.safeParse({ mode: "trampa" }).success).toBe(false);
  });
});

describe("answerSchema", () => {
  it("acepta una opción (letra)", () => {
    expect(answerSchema.safeParse({ position: 1, optionId: "B" }).success).toBe(true);
  });
  it("rechaza ids de opción que no son una letra", () => {
    expect(answerSchema.safeParse({ position: 1, optionId: "123" }).success).toBe(false);
  });
  it("acepta tiempo agotado sin respuesta", () => {
    expect(answerSchema.safeParse({ position: 1, timeout: true }).success).toBe(true);
  });
  it("rechaza opción y texto a la vez", () => {
    expect(answerSchema.safeParse({ position: 1, optionId: "B", text: "Figo" }).success).toBe(false);
  });
  it("rechaza opción y timeout a la vez", () => {
    expect(answerSchema.safeParse({ position: 1, optionId: "B", timeout: true }).success).toBe(false);
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

describe("signUpSchema", () => {
  const ok = { username: "pepe_10", email: "pepe@ejemplo.es", password: "12345678", difficulty: "aficionado", acceptTerms: "on" };
  it("acepta un registro válido", () => {
    expect(signUpSchema.safeParse(ok).success).toBe(true);
  });
  it("rechaza usernames con espacios o símbolos", () => {
    expect(signUpSchema.safeParse({ ...ok, username: "pe pe" }).success).toBe(false);
  });
  it("exige aceptar la privacidad", () => {
    expect(signUpSchema.safeParse({ ...ok, acceptTerms: undefined }).success).toBe(false);
  });
  it("exige contraseña de 8 o más", () => {
    expect(signUpSchema.safeParse({ ...ok, password: "1234" }).success).toBe(false);
  });
});
