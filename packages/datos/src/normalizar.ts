/**
 * Normaliza una respuesta escrita para compararla con question_accepted_answers.answer_norm.
 * Copia exacta de packages/shared/src/schemas.ts#normalizeAnswer: los dos lados (generador
 * y servidor) tienen que normalizar igual. Si cambias una, cambia la otra (hay test).
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
