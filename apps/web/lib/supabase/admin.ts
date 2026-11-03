import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la clave SECRETA: se salta RLS.
 * Solo para la lógica de juego en el servidor (corregir, puntuar, cerrar partidas).
 * `server-only` hace que el build falle si alguien lo importa desde un componente de cliente.
 */
let admin: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en apps/web/.env.local");
  }
  admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
