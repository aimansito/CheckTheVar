import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { currentGuestId } from "@/lib/game/player";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Enlace del email de confirmación: valida el token, abre sesión y traspasa puntos de invitado. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type) redirect("/entrar?error=enlace");

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) redirect("/entrar?error=enlace");

  const guestId = await currentGuestId();
  if (guestId) {
    await getSupabaseAdmin().rpc("claim_guest", { p_user: data.user.id, p_guest: guestId });
  }
  redirect("/perfil?bienvenida=1");
}
