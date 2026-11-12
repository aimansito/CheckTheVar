import "server-only";
import { DEFAULT_DIFFICULTY, DIFFICULTY_LEVELS, type DifficultyLevel } from "@checkthevar/shared";
import { getSupabaseServer } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string;
  displayName: string | null;
  difficulty: DifficultyLevel;
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
  gamesPlayed: number;
  answersCorrect: number;
  answersTotal: number;
};

/** Perfil del usuario con sesión (o null). Lee con RLS: solo sus propias filas. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: stats }] = await Promise.all([
    supabase.from("users").select("id, username, display_name, difficulty").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_stats")
      .select("total_points, current_streak, best_streak, games_played, answers_correct, answers_total")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!profile) return null;

  return {
    id: profile.id as string,
    username: profile.username as string,
    displayName: (profile.display_name as string | null) ?? null,
    difficulty: (profile.difficulty as string) in DIFFICULTY_LEVELS ? (profile.difficulty as DifficultyLevel) : DEFAULT_DIFFICULTY,
    totalPoints: Number(stats?.total_points ?? 0),
    currentStreak: Number(stats?.current_streak ?? 0),
    bestStreak: Number(stats?.best_streak ?? 0),
    gamesPlayed: Number(stats?.games_played ?? 0),
    answersCorrect: Number(stats?.answers_correct ?? 0),
    answersTotal: Number(stats?.answers_total ?? 0),
  };
}

export type Trophy = { id: number; title: string; earnedAt: string };

/** Vitrina: trofeos del usuario con sesión (RLS: solo los suyos). */
export async function getTrophies(): Promise<Trophy[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("user_trophies").select("id, title, earned_at").order("earned_at", { ascending: false });
  return (data ?? []).map((t) => ({ id: Number(t.id), title: String(t.title), earnedAt: String(t.earned_at) }));
}

export type ModeStats = Record<string, { bestScore: number; gamesPlayed: number; bestStreak: number }>;

/** Mejores marcas por modo del usuario con sesión (RLS: solo las suyas). */
export async function getModeStats(): Promise<ModeStats> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("user_mode_stats")
    .select("best_score, games_played, best_streak, game_modes(slug)");
  const out: ModeStats = {};
  for (const row of data ?? []) {
    const slug = (row.game_modes as unknown as { slug: string } | null)?.slug;
    if (slug) out[slug] = { bestScore: Number(row.best_score), gamesPlayed: Number(row.games_played), bestStreak: Number(row.best_streak) };
  }
  return out;
}
