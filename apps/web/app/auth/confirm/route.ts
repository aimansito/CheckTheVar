import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { currentGuestId } from "@/lib/game/player";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { safeNext } from "@/lib/safe-next";
import { getSupabaseServer } from "@/lib/supabase/server";


/**
 * Enlaces de email (confirmación de cuenta, recuperación de contraseña, cambio de email):
 * valida el token, abre sesión y traspasa los puntos de invitado.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (!tokenHash || !type) redirect("/entrar?error=enlace");

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) redirect("/entrar?error=enlace");

  if (type === "recovery") redirect(next ?? "/nueva-contrasena");

  const guestId = await currentGuestId();
  if (guestId) {
    await getSupabaseAdmin().rpc("claim_guest", { p_user: data.user.id, p_guest: guestId });
  }
  // Si venía de una invitación a liga, vuelve allí; si no, a la bienvenida.
  redirect(next ?? safeNext(data.user.user_metadata?.next) ?? "/bienvenida");
}
