import "server-only";
import type { AdminQuestionFilters } from "@checkthevar/shared";
import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export type Admin = { id: string; username: string };

/**
 * Exige un admin con sesión. Sin sesión → a /entrar; con sesión pero sin permiso → 404,
 * para no revelar que el panel existe. is_admin solo se puede cambiar desde SQL.
 */
export async function requireAdmin(): Promise<Admin> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/admin");
  const { data } = await getSupabaseAdmin()
    .from("users")
    .select("id, username, is_admin")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data?.is_admin) notFound();
  return { id: String(data.id), username: String(data.username) };
}

/** ¿El usuario con sesión es admin? Para mostrar el enlace al panel. */
export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from("users").select("is_admin").eq("id", userId).maybeSingle();
  return Boolean(data?.is_admin);
}

/** Fecha de hoy en España (los retos diarios cambian a medianoche de Madrid). */
export function todayInSpain(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

/* ───────── Resumen ───────── */

export type Overview = {
  users: { total: number; today: number; week: number; flagged: number; admins: number };
  games: { today: number; week: number; playersToday: number; guestsToday: number; abandonedWeek: number };
  byMode: { slug: string; today: number; week: number }[];
  daily14: { date: string; games: number; signups: number }[];
  guests: { total: number; converted: number };
  questions: Partial<Record<"draft" | "review" | "published" | "retired", number>> | null;
  reportsOpen: number;
  leagues: { total: number; members: number };
};

export async function getOverview(): Promise<Overview> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_overview");
  if (error) throw new Error(`admin_overview: ${error.message}`);
  return data as Overview;
}

export type DailyChallengeReport = {
  id: number;
  plays: number;
  questions: { position: number; id: number; difficulty: number; prompt: string | null; answer: string | null; answered: number; correct: number }[];
} | null;

export async function getDailyChallenge(date: string): Promise<DailyChallengeReport> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_daily_challenge", { p_date: date });
  if (error) throw new Error(`admin_daily_challenge: ${error.message}`);
  return data as DailyChallengeReport;
}

/* ───────── Preguntas ───────── */

export const PAGE_SIZE = 30;

export type QuestionRow = {
  id: number;
  kind: string;
  status: string;
  difficulty: number;
  era_from: number | null;
  era_to: number | null;
  generator_key: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  prompt: string | null;
  answer: string | null;
  shown: number;
  correct: number;
  reports: number;
};

export async function listQuestions(f: AdminQuestionFilters): Promise<{ total: number; rows: QuestionRow[] }> {
  const page = f.pagina ?? 1;
  const { data, error } = await getSupabaseAdmin().rpc("admin_questions", {
    p_status: f.estado ?? null,
    p_kind: f.tipo ?? null,
    p_search: f.q || null,
    p_order: f.orden ?? "recientes",
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`admin_questions: ${error.message}`);
  return data as { total: number; rows: QuestionRow[] };
}

export type QuestionDetail = {
  id: number;
  kind: string;
  format: string;
  status: string;
  difficulty: number;
  eraFrom: number | null;
  eraTo: number | null;
  generatorKey: string | null;
  sourceUrl: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  prompt: string | null;
  explanation: string | null;
  options: { position: number; label: string; isCorrect: boolean }[];
  accepted: string[];
  clues: string[];
  shown: number;
  correct: number;
  avgTimeMs: number | null;
  reports: { id: number; reason: string; status: string; createdAt: string; username: string | null }[];
};

export async function getQuestion(id: number): Promise<QuestionDetail | null> {
  const db = getSupabaseAdmin();
  const { data: q } = await db
    .from("questions")
    .select(
      "id, kind, format, status, difficulty, era_from, era_to, generator_key, source_url, review_note, reviewed_at, created_at, reviewer:users!questions_reviewed_by_fkey(username)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!q) return null;

  const [tr, opts, acc, clues, stats, reports] = await Promise.all([
    db.from("question_translations").select("prompt, explanation").eq("question_id", id).eq("language", "es").maybeSingle(),
    db
      .from("question_options")
      .select("position, is_correct, question_option_translations(label, language)")
      .eq("question_id", id)
      .order("position"),
    db.from("question_accepted_answers").select("answer_norm").eq("question_id", id),
    db.from("question_clues").select("clue, position").eq("question_id", id).eq("language", "es").order("position"),
    db.from("question_stats").select("times_shown, times_correct, avg_time_ms").eq("question_id", id).maybeSingle(),
    db
      .from("question_reports")
      .select("id, reason, status, created_at, users!question_reports_user_id_fkey(username)")
      .eq("question_id", id)
      .order("created_at", { ascending: false }),
  ]);

  type OptionRow = { position: number; is_correct: boolean; question_option_translations: { label: string; language: string }[] };
  type ReportRow = { id: number; reason: string; status: string; created_at: string; users: { username: string } | null };

  return {
    id: Number(q.id),
    kind: String(q.kind),
    format: String(q.format),
    status: String(q.status),
    difficulty: Number(q.difficulty),
    eraFrom: q.era_from as number | null,
    eraTo: q.era_to as number | null,
    generatorKey: q.generator_key as string | null,
    sourceUrl: q.source_url as string | null,
    reviewNote: q.review_note as string | null,
    reviewedAt: q.reviewed_at as string | null,
    reviewedBy: (q.reviewer as unknown as { username: string } | null)?.username ?? null,
    createdAt: String(q.created_at),
    prompt: tr.data?.prompt ?? null,
    explanation: tr.data?.explanation ?? null,
    options: ((opts.data ?? []) as unknown as OptionRow[]).map((o) => ({
      position: o.position,
      isCorrect: o.is_correct,
      label: o.question_option_translations.find((t) => t.language === "es")?.label ?? "—",
    })),
    accepted: (acc.data ?? []).map((a) => String(a.answer_norm)),
    clues: (clues.data ?? []).map((c) => String(c.clue)),
    shown: Number(stats.data?.times_shown ?? 0),
    correct: Number(stats.data?.times_correct ?? 0),
    avgTimeMs: (stats.data?.avg_time_ms as number | null) ?? null,
    reports: ((reports.data ?? []) as unknown as ReportRow[]).map((r) => ({
      id: Number(r.id),
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at,
      username: r.users?.username ?? null,
    })),
  };
}

/* ───────── Reportes ───────── */

export type ReportRow = {
  id: number;
  questionId: number;
  reason: string;
  status: string;
  createdAt: string;
  username: string | null;
  prompt: string | null;
  questionStatus: string | null;
};

export async function listReports(status: "open" | "closed"): Promise<ReportRow[]> {
  const query = getSupabaseAdmin()
    .from("question_reports")
    .select(
      "id, question_id, reason, status, created_at, users!question_reports_user_id_fkey(username), questions(status, question_translations(prompt, language))",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const { data, error } = status === "open" ? await query.eq("status", "open") : await query.neq("status", "open");
  if (error) throw new Error(`reports: ${error.message}`);

  type Row = {
    id: number;
    question_id: number;
    reason: string;
    status: string;
    created_at: string;
    users: { username: string } | null;
    questions: { status: string; question_translations: { prompt: string; language: string }[] } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: Number(r.id),
    questionId: Number(r.question_id),
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    username: r.users?.username ?? null,
    prompt: r.questions?.question_translations.find((t) => t.language === "es")?.prompt ?? null,
    questionStatus: r.questions?.status ?? null,
  }));
}

/* ───────── Usuarios ───────── */

export type UserRow = {
  id: string;
  username: string;
  email: string;
  plan: string;
  isAdmin: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  flaggedAt: string | null;
  flaggedReason: string | null;
  points: number;
  games: number;
  accuracy: number | null;
};

export async function listUsers(opts: { search?: string; flagged?: boolean; page: number }): Promise<{ total: number; rows: UserRow[] }> {
  let query = getSupabaseAdmin()
    .from("users")
    .select(
      "id, username, email, plan, is_admin, created_at, last_seen_at, flagged_at, flagged_reason, user_stats(total_points, games_played, answers_correct, answers_total)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range((opts.page - 1) * PAGE_SIZE, opts.page * PAGE_SIZE - 1);
  // Solo letras, números y . _ @ - : evita romper la sintaxis del filtro or().
  const term = opts.search?.replace(/[^\p{L}\p{N}._@-]/gu, "").slice(0, 60);
  if (term) query = query.or(`username.ilike.%${term}%,email.ilike.%${term}%`);
  if (opts.flagged) query = query.not("flagged_at", "is", null);

  const { data, count, error } = await query;
  if (error) throw new Error(`users: ${error.message}`);

  type Stats = { total_points: number; games_played: number; answers_correct: number; answers_total: number };
  return {
    total: count ?? 0,
    rows: (data ?? []).map((u) => {
      const raw = u.user_stats as unknown as Stats | Stats[] | null;
      const s = Array.isArray(raw) ? raw[0] : raw;
      return {
        id: String(u.id),
        username: String(u.username),
        email: String(u.email),
        plan: String(u.plan),
        isAdmin: Boolean(u.is_admin),
        createdAt: String(u.created_at),
        lastSeenAt: u.last_seen_at as string | null,
        flaggedAt: u.flagged_at as string | null,
        flaggedReason: u.flagged_reason as string | null,
        points: Number(s?.total_points ?? 0),
        games: Number(s?.games_played ?? 0),
        accuracy: s?.answers_total ? Math.round((s.answers_correct / s.answers_total) * 100) : null,
      };
    }),
  };
}

/* ───────── Ligas ───────── */

export type LeagueRow = {
  id: number;
  name: string;
  format: string;
  visibility: string;
  createdAt: string;
  owner: string | null;
  members: number;
};

export async function listLeagues(): Promise<LeagueRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("leagues")
    .select("id, name, format, visibility, created_at, owner:users!leagues_owner_id_fkey(username), league_members(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`leagues: ${error.message}`);
  return (data ?? []).map((l) => ({
    id: Number(l.id),
    name: String(l.name),
    format: String(l.format),
    visibility: String(l.visibility),
    createdAt: String(l.created_at),
    owner: (l.owner as unknown as { username: string } | null)?.username ?? null,
    members: Number((l.league_members as unknown as { count: number }[])[0]?.count ?? 0),
  }));
}

/* ───────── Registro de acciones ───────── */

export type ActionRow = { id: number; action: string; target: string; detail: unknown; createdAt: string; admin: string | null };

export async function listActions(limit = 15): Promise<ActionRow[]> {
  const { data } = await getSupabaseAdmin()
    .from("admin_actions")
    .select("id, action, target, detail, created_at, users(username)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((a) => ({
    id: Number(a.id),
    action: String(a.action),
    target: String(a.target),
    detail: a.detail,
    createdAt: String(a.created_at),
    admin: (a.users as unknown as { username: string } | null)?.username ?? null,
  }));
}
