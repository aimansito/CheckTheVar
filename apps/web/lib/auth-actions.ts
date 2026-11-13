"use server";

import { newPasswordSchema, oauthSchema, resetRequestSchema, signInSchema, signUpSchema } from "@checkthevar/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentGuestId } from "@/lib/game/player";
import { LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  info?: string;
  /** Cuenta creada y pendiente de confirmar: email al que se ha enviado el enlace. */
  sent?: string;
  values?: { username?: string; email?: string };
};

const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a probarlo.";

/** Origen público de la web (para los enlaces de email y OAuth). */
async function siteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

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

  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, LIMITS.signUpPerIp.limit, LIMITS.signUpPerIp.windowSec)).ok) {
    return { error: TOO_MANY, values };
  }

  const { username, email, password, difficulty } = parsed.data;
  const next = safeNext(raw.next);

  const { data: taken } = await getSupabaseAdmin()
    .from("users")
    .select("id")
    .eq("username", username) // citext: ya compara sin mayúsculas (ilike trataría "_" como comodín)
    .maybeSingle();
  if (taken) return { fieldErrors: { username: "Ese nombre ya está cogido." }, values };

  const origin = await siteOrigin();
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // "next" viaja en los metadatos: /auth/confirm lo lee de ahí al confirmar (la plantilla
      // del email usa {{ .SiteURL }} y no depende de la URL de redirección).
      data: { username, display_name: username, difficulty, ...(next ? { next } : {}) },
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
    return { sent: email, values };
  }

  if (data.user) await claimGuestPoints(data.user.id);
  redirect(next ?? "/bienvenida");
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(form);
  const values = { email: String(raw.email ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };

  const ip = await clientIp();
  if (!(await rateLimit(`signin:${ip}`, LIMITS.signInPerIp.limit, LIMITS.signInPerIp.windowSec)).ok) {
    return { error: TOO_MANY, values };
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: "Email o contraseña incorrectos.", values };
  }
  await claimGuestPoints(data.user.id);
  redirect(safeNext(raw.next) ?? "/perfil");
}

/** Acceso con Google o Apple (OAuth con PKCE: el código vuelve a /auth/callback). */
export async function signInWithProvider(form: FormData): Promise<void> {
  const parsed = oauthSchema.safeParse({ provider: form.get("provider") });
  if (!parsed.success) redirect("/entrar?error=proveedor");

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data.provider,
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect("/entrar?error=proveedor");
  redirect(data.url);
}

export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(form);
  const values = { email: String(raw.email ?? "") };
  const parsed = resetRequestSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };

  const ip = await clientIp();
  if (!(await rateLimit(`reset:${ip}`, LIMITS.resetPerIp.limit, LIMITS.resetPerIp.windowSec)).ok) {
    return { error: TOO_MANY, values };
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/nueva-contrasena`,
  });
  if (error) console.error("[auth] reset falló:", error.message);
  // Misma respuesta exista o no la cuenta: no se revela qué emails están registrados.
  return { info: "Si ese email tiene cuenta, te hemos enviado un enlace para cambiar la contraseña.", values };
}

/** Reenvía el email de confirmación de una cuenta recién creada. */
export async function resendConfirmation(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Email no válido." };

  const ip = await clientIp();
  if (!(await rateLimit(`resend:${ip}`, LIMITS.resetPerIp.limit, LIMITS.resetPerIp.windowSec)).ok) {
    return { error: TOO_MANY };
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error) console.error("[auth] reenvío de confirmación falló:", error.message);
  return { info: "Listo: te hemos enviado otro correo. Puede tardar un par de minutos." };
}

export async function updatePassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?error=enlace");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: /same password/i.test(error.message) ? "Esa ya es tu contraseña." : "No se pudo cambiar la contraseña. Inténtalo de nuevo." };
  }
  redirect("/perfil?contrasena=1");
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
