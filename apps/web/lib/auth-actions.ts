"use server";

import { signInSchema, signUpSchema } from "@checkthevar/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentGuestId } from "@/lib/game/player";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  info?: string;
  values?: { username?: string; email?: string };
};

/** Pasa a la cuenta los puntos y la partida de hoy jugados como invitado. */
async function claimGuestPoints(userId: string): Promise<void> {
  const guestId = await currentGuestId();
  if (!guestId) return;
  const { error } = await getSupabaseAdmin().rpc("claim_guest", { p_user: userId, p_guest: guestId });
  if (error) console.error("[auth] claim_guest falló:", error.message);
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(form);
  const values = { username: String(raw.username ?? ""), email: String(raw.email ?? "") };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };

  const { username, email, password } = parsed.data;

  const { data: taken } = await getSupabaseAdmin()
    .from("users")
    .select("id")
    .eq("username", username) // citext: ya compara sin mayúsculas (ilike trataría "_" como comodín)
    .maybeSingle();
  if (taken) return { fieldErrors: { username: "Ese nombre ya está cogido." }, values };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: username },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  if (error) {
    const msg = /registered|exists/i.test(error.message)
      ? "Ya hay una cuenta con ese email. Prueba a iniciar sesión."
      : "No se pudo crear la cuenta. Inténtalo de nuevo.";
    return { error: msg, values };
  }

  if (!data.session) {
    // Proyecto con confirmación de email: los puntos se traspasan al confirmar.
    return { info: "Te hemos enviado un email para confirmar tu cuenta. Revisa tu bandeja de entrada.", values };
  }

  if (data.user) await claimGuestPoints(data.user.id);
  redirect("/perfil?bienvenida=1");
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(form);
  const values = { email: String(raw.email ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: "Email o contraseña incorrectos.", values };
  }
  await claimGuestPoints(data.user.id);
  redirect("/perfil");
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
