/**
 * Validación (zod) de la entrada de los endpoints de partida.
 * El servidor valida SIEMPRE con estos esquemas antes de tocar la base de datos.
 */
import { z } from "zod";
import { DIFFICULTY_SLUGS } from "./scoring";
import { GAME_MODES } from "./types";

export const startGameSchema = z.object({
  mode: z.enum(GAME_MODES),
  /** Reto concreto (p. ej. el diario de hoy). Si falta, el servidor elige el de hoy. */
  challengeId: z.coerce.number().int().positive().optional(),
  /** Jornada de liga, si la partida es de liga. */
  matchdayId: z.coerce.number().int().positive().optional(),
  /** Nivel elegido antes de empezar. Si falta, el de su perfil. */
  difficulty: z.enum(DIFFICULTY_SLUGS).optional(),
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

/** Pedir una pista más en una pregunta con pistas. */
export const clueSchema = z.object({
  position: z.number().int().min(1).max(50),
});
export type ClueInput = z.infer<typeof clueSchema>;

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
  difficulty: z.enum(DIFFICULTY_SLUGS, { error: "Elige un nivel." }),
  acceptTerms: z.literal("on", { error: "Tienes que aceptar la política de privacidad." }),
});

export const difficultySchema = z.object({ difficulty: z.enum(DIFFICULTY_SLUGS) });

/** Crear liga privada. */
export const createLeagueSchema = z.object({
  name: z.string().trim().min(3, "Mínimo 3 caracteres.").max(40, "Máximo 40 caracteres."),
  format: z.enum(["points", "head_to_head"]),
  difficulty: z.enum(DIFFICULTY_SLUGS),
});

/** Unirse con código (sin letras ambiguas: ni 0/O ni 1/I/L). */
export const joinLeagueSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJKMNP-Z2-9]{6}$/, "El código tiene 6 caracteres."),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email("Email no válido.").max(254),
  password: z.string().min(1, "Escribe tu contraseña.").max(72),
});
export type SignInInput = z.infer<typeof signInSchema>;

/** Recuperar contraseña: solo el email. */
export const resetRequestSchema = z.object({
  email: z.email("Email no válido.").max(254),
});

/** Nueva contraseña (tras el enlace de recuperación). */
export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres.").max(72),
    confirm: z.string().max(72),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden." });

export const OAUTH_PROVIDERS = ["google", "apple"] as const;
export const oauthSchema = z.object({ provider: z.enum(OAUTH_PROVIDERS) });
