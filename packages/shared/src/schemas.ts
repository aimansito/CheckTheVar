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

/**
 * CHECK THE VAR: una opción (tipo test), un texto (respuesta libre) o `timeout`
 * (se acabó el tiempo sin responder). Exactamente uno de los tres.
 */
export const answerSchema = z
  .object({
    position: z.number().int().min(1).max(50),
    optionId: z.string().regex(/^[A-Z]$/).optional(),
    text: z.string().trim().min(1).max(80).optional(),
    timeout: z.literal(true).optional(),
  })
  .refine((v) => [v.optionId, v.text, v.timeout].filter((x) => x !== undefined).length === 1, {
    message: "Envía optionId, text o timeout (solo uno).",
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

/** Registro con email y contraseña. */
export const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(24, "Máximo 24 caracteres.")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo."),
  email: z.email("Email no válido.").max(254),
  password: z.string().min(8, "Mínimo 8 caracteres.").max(72),
  acceptTerms: z.literal("on", { error: "Tienes que aceptar la política de privacidad." }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email("Email no válido.").max(254),
  password: z.string().min(1, "Escribe tu contraseña.").max(72),
});
export type SignInInput = z.infer<typeof signInSchema>;
