import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string;
  displayName: string | null;
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
};

/** Perfil del usuario con sesión (o null). Lee con RLS: solo sus propias filas. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: stats }] = await Promise.all([
    supabase.from("users").select("id, username, display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_stats")
      .select("total_points, current_streak, best_streak")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!profile) return null;

  return {
    id: profile.id as string,
    username: profile.username as string,
    displayName: (profile.display_name as string | null) ?? null,
    totalPoints: Number(stats?.total_points ?? 0),
    currentStreak: Number(stats?.current_streak ?? 0),
    bestStreak: Number(stats?.best_streak ?? 0),
  };
}
