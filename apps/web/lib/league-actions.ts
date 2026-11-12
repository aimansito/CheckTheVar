"use server";

import { DIFFICULTY_LEVELS, createLeagueSchema, difficultySchema, joinLeagueSchema } from "@checkthevar/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/leagues";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; info?: string };

const ERRORS: Record<string, string> = {
  league_not_found: "No hay ninguna liga con ese código. Revisa que esté bien escrito.",
  league_full: "Esa liga ya está completa.",
  league_limit: "Ya tienes 10 ligas creadas. Elimina alguna para crear otra.",
  not_member: "No eres miembro de esa liga.",
  invalid_input: "Revisa los datos.",
};

function firstErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

async function requireUser(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) redirect("/entrar?next=/ligas");
  return userId;
}

export async function createLeague(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUser();
  const parsed = createLeagueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error.issues) };
  if (!(await rateLimit(`league-create:${userId}`, 10, 3600)).ok) return { error: "Demasiadas ligas en poco tiempo. Espera un rato." };

  const d = DIFFICULTY_LEVELS[parsed.data.difficulty];
  const { data, error } = await getSupabaseAdmin().rpc("league_create", {
    p_user: userId,
    p_name: parsed.data.name,
    p_format: parsed.data.format,
    p_level: parsed.data.difficulty,
    p_min: d.min,
    p_max: d.max,
    p_old: d.oldEra,
  });
  if (error) return { error: ERRORS[error.message] ?? "No se pudo crear la liga. Inténtalo de nuevo." };
  redirect(`/ligas/${data}?nueva=1`);
}

export async function joinLeague(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUser();
  const parsed = joinLeagueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error.issues) };
  // Frena el probar códigos a ciegas.
  if (!(await rateLimit(`league-join:${await clientIp()}`, 20, 3600)).ok) return { error: "Demasiados intentos. Espera un rato." };

  const { data, error } = await getSupabaseAdmin().rpc("league_join", { p_user: userId, p_code: parsed.data.code });
  if (error) return { error: ERRORS[error.message] ?? "No se pudo unir a la liga." };
  redirect(`/ligas/${data}`);
}

export async function leaveLeague(form: FormData): Promise<void> {
  const userId = await requireUser();
  const leagueId = Number(form.get("leagueId"));
  if (!Number.isInteger(leagueId) || leagueId <= 0) redirect("/ligas");
  const { error } = await getSupabaseAdmin().rpc("league_leave", { p_user: userId, p_league: leagueId });
  if (error && error.message !== "not_member") console.error("[ligas] league_leave:", error.message);
  revalidatePath("/ligas");
  redirect("/ligas");
}

export async function updateDifficulty(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = await currentUserId();
  if (!userId) redirect("/entrar");
  const parsed = difficultySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Elige un nivel." };
  const { error } = await getSupabaseAdmin().rpc("user_set_difficulty", { p_user: userId, p_level: parsed.data.difficulty });
  if (error) return { error: "No se pudo guardar. Inténtalo de nuevo." };
  revalidatePath("/perfil");
  return { info: `Nivel guardado: ${DIFFICULTY_LEVELS[parsed.data.difficulty].name}.` };
}
