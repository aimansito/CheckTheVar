/**
 * Validación (zod) de la entrada de los endpoints de partida.
 * El servidor valida SIEMPRE con estos esquemas antes de tocar la base de datos.
 */
import { z } from "zod";
import { GAME_MODES } from "./types";

export const startGameSchema = z.object({
  mode: z.enum(GAME_MODES),
  /** Reto concreto (p. ej. el diario de hoy). Si falta, el servidor elige el de hoy. */
  challengeId: z.coerce.number().int().positive().optional(),
  /** Jornada de liga, si la partida es de liga. */
  matchdayId: z.coerce.number().int().positive().optional(),
});
export type StartGameInput = z.infer<typeof startGameSchema>;

export const sessionParamsSchema = z.object({
  sessionId: z.uuid(),
});

/** CHECK THE VAR: una opción (tipo test) o un texto (respuesta libre), nunca ambas. */
export const answerSchema = z
  .object({
    position: z.number().int().min(1).max(50),
    optionId: z.string().min(1).max(64).optional(),
    text: z.string().trim().min(1).max(80).optional(),
  })
  .refine((v) => (v.optionId === undefined) !== (v.text === undefined), {
    message: "Envía optionId o text, no ambos.",
  });
export type AnswerInput = z.infer<typeof answerSchema>;

/** Normaliza texto libre para comparar con question_accepted_answers.answer_norm. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
