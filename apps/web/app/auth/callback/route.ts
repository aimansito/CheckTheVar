import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { currentGuestId } from "@/lib/game/player";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Vuelta de Google/Apple (PKCE): cambia el código por una sesión y traspasa puntos de invitado. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) redirect("/entrar?error=proveedor");

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) redirect("/entrar?error=proveedor");

  const guestId = await currentGuestId();
  if (guestId) {
    await getSupabaseAdmin().rpc("claim_guest", { p_user: data.user.id, p_guest: guestId });
  }
  redirect("/perfil?bienvenida=1");
}
