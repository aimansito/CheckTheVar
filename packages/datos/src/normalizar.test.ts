import { describe, expect, it } from "vitest";
import { normalizeAnswer } from "./normalizar.ts";

describe("normalizeAnswer (copia exacta de packages/shared/src/schemas.ts)", () => {
  it("quita tildes, mayúsculas y signos, y compacta espacios", () => {
    expect(normalizeAnswer("  Luís  FIGO! ")).toBe("luis figo");
    expect(normalizeAnswer("Modrić")).toBe("modric");
    expect(normalizeAnswer("Kun Agüero")).toBe("kun aguero");
    expect(normalizeAnswer("N'Golo Kanté")).toBe("n golo kante");
  });
});
