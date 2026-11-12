import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Ligas: toda la lógica vive en funciones SQL (league_*), que solo puede ejecutar el servidor.
 * Aquí se comprueba quién es el usuario y se llama a esas funciones en su nombre.
 */

export type LeagueSummary = {
  id: number;
  name: string;
  format: "points" | "head_to_head";
  difficulty: string;
  isOwner: boolean;
  members: number;
  season: number | null;
  matchday: number | null;
  theme: string | null;
  closesAt: string | null;
  played: boolean;
  position: number | null;
};

export type StandingRow = {
  position: number;
  userId: string;
  username: string;
  isMe: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  totalScore: number;
};

export type FixtureRow = {
  home: string;
  away: string | null;
  homeIsMe: boolean;
  awayIsMe: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type LeagueView = {
  id: number;
  name: string;
  format: "points" | "head_to_head";
  difficulty: string;
  inviteCode: string;
  isOwner: boolean;
  maxMembers: number;
  season: { id: number; number: number; status: "active" | "finished" };
  members: { userId: string; username: string; role: string; isMe: boolean }[];
  standings: StandingRow[];
  matchdays: { id: number; number: number; theme: string | null; opensAt: string; closesAt: string; status: "scheduled" | "open" | "closed" }[];
  current: null | {
    id: number;
    number: number;
    theme: string | null;
    closesAt: string;
    questions: number;
    myStatus: "playing" | "played" | null;
    results: { userId: string; username: string; isMe: boolean; score: number; correct: number; finished: boolean }[];
    fixtures: FixtureRow[];
  };
  last: null | {
    number: number;
    theme: string | null;
    results: { username: string; isMe: boolean; score: number; correct: number; played: boolean; points: number }[];
    fixtures: FixtureRow[];
  };
  champion: string | null;
};

export async function currentUserId(): Promise<string | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listLeagues(userId: string): Promise<LeagueSummary[]> {
  const { data, error } = await getSupabaseAdmin().rpc("league_list", { p_user: userId });
  if (error) throw new Error(`league_list: ${error.message}`);
  return (data ?? []) as LeagueSummary[];
}

/** Vista de una liga, o null si no existe o el usuario no es miembro. */
export async function viewLeague(userId: string, leagueId: number): Promise<LeagueView | null> {
  const { data, error } = await getSupabaseAdmin().rpc("league_view", { p_user: userId, p_league: leagueId });
  if (error) {
    if (error.message === "not_member") return null;
    throw new Error(`league_view: ${error.message}`);
  }
  return data as LeagueView;
}

/** Datos públicos mínimos de una invitación (nombre y miembros), sin exponer nada más. */
export async function inviteInfo(code: string): Promise<{ id: number; name: string; members: number; maxMembers: number } | null> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("leagues")
    .select("id, name, max_members, deleted_at")
    .eq("invite_code", code.toUpperCase())
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const { count } = await db.from("league_members").select("*", { count: "exact", head: true }).eq("league_id", data.id);
  return { id: Number(data.id), name: String(data.name), members: count ?? 0, maxMembers: Number(data.max_members) };
}
