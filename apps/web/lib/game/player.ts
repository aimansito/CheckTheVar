import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { GUEST_COOKIE, GUEST_TOKEN_RE, guestCookieOptions, newGuestToken } from "./guest-cookie";

/** Quién está jugando: un usuario registrado o un invitado (identificado por cookie). */
export type Player =
  | { kind: "user"; userId: string; guestId: null }
  | { kind: "guest"; userId: null; guestId: string };

/** En la BD solo se guarda el hash del token: si se filtra la tabla, no sirve para suplantar. */
export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Identifica al jugador de la petición.
 * - Con sesión de Supabase → usuario.
 * - Sin sesión → invitado. Si `createGuest` y no tiene cookie, se le crea una.
 * Devuelve null si es un invitado sin cookie y no se pide crearla.
 */
export async function resolvePlayer({ createGuest }: { createGuest: boolean }): Promise<Player | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { kind: "user", userId: user.id, guestId: null };
  }

  const store = await cookies();
  let token = store.get(GUEST_COOKIE)?.value;
  if (!token || !GUEST_TOKEN_RE.test(token)) {
    // Normalmente la crea el proxy antes; esto es solo por si la petición llega sin ella.
    if (!createGuest) return null;
    token = newGuestToken();
    store.set(GUEST_COOKIE, token, guestCookieOptions);
  }

  const { data, error } = await getSupabaseAdmin().rpc("game_resolve_guest", {
    p_token_hash: hashGuestToken(token),
  });
  if (error || typeof data !== "string") {
    throw new Error(`No se pudo identificar al invitado: ${error?.message ?? "sin id"}`);
  }
  return { kind: "guest", userId: null, guestId: data };
}

/** Id de invitado de la cookie actual (sin crearla). Para traspasar puntos al registrarse. */
export async function currentGuestId(): Promise<string | null> {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!token || !GUEST_TOKEN_RE.test(token)) return null;
  const { data } = await getSupabaseAdmin().rpc("game_resolve_guest", {
    p_token_hash: hashGuestToken(token),
  });
  return typeof data === "string" ? data : null;
}
