// Genera preguntas a partir de los datos de fútbol ya cargados en Supabase.
//
// Uso (desde la raíz):
//   pnpm datos:preguntas                 genera en estado `review` (sin publicar)
//   pnpm datos:preguntas --publicar      genera y publica (los datos ya traen su fuente)
//   pnpm datos:preguntas --regenerar     retira las generadas antes y las crea de nuevo
//   pnpm datos:preguntas --solo clave    solo una plantilla (p. ej. final_score)
//   pnpm datos:preguntas --simular       no escribe nada: muestra cuántas saldrían y ejemplos
// Es idempotente: cada pregunta tiene (generator_key, generator_ref) único y no se repite.
// Nada se inventa: cada pregunta nace de filas con source_url y la lleva en `source_url`.
import { existsSync, resolve } from "./_env.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeAnswer } from "./normalizar.ts";
import { loadData, type Data, type Player, type Team, type Match } from "./preguntas-datos.ts";
import { seededRandom } from "./aleatorio.ts";

export type Option = { label: string; correct: boolean; playerId?: number; teamId?: number };
export type Generated = {
  key: string;
  ref: string;
  kind: "quiz" | "higher_lower" | "guess_player" | "career_path";
  format: "multiple_choice" | "free_text";
  category: string;
  competitionId?: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  era?: [number, number];
  prompt: string;
  explanation: string;
  options: Option[];
  accepted?: string[];
  clues?: string[];
  entities: { players?: number[]; teams?: number[]; competitions?: number[] };
  source: string;
};

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (f: string) => args.includes(f);
const only = args.includes("--solo") ? args[args.indexOf("--solo") + 1] : undefined;

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------
const yearOf = (label: string) => Number(label.slice(0, 4));

/**
 * Dificultad 1–5 = base de la plantilla + época + fama del protagonista.
 *  época: 2005+ → 0 · 1990–2004 → 1 · 1970–1989 → 2 · antes → 3
 *  fama:  conocido por cualquiera → 0 · conocido por aficionados → 1 · desconocido → 2
 */
type Level = 1 | 2 | 3 | 4 | 5;
const eraLevel = (y: number | null | undefined) => (y == null ? 2 : y >= 2005 ? 0 : y >= 1990 ? 1 : y >= 1970 ? 2 : 3);
const level = (...parts: number[]): Level => Math.min(5, Math.max(1, 1 + parts.reduce((a, b) => a + b, 0))) as Level;

const fameCache = new Map<number, 0 | 1 | 2>();
/** Fama de un jugador según lo que hay en los datos (premios, alias, goles en finales, récords). */
function fameOf(d: Data, playerId: number): 0 | 1 | 2 {
  const cached = fameCache.get(playerId);
  if (cached !== undefined) return cached;
  const awards = d.awardWinners.filter((w) => w.player_id === playerId);
  const score =
    awards.filter((w) => w.rank === 1).length * 3 +
    awards.filter((w) => w.rank > 1).length +
    (d.aliasesByPlayer.get(playerId)?.length ?? 0) +
    d.records.filter((r) => r.player_id === playerId).length * 3 +
    Math.min(3, d.finalGoalsByPlayer.get(playerId) ?? 0) +
    (d.transfers.some((t) => t.player_id === playerId && Number(t.fee_amount ?? 0) >= 50_000_000) ? 2 : 0);
  const fame = score >= 4 ? 0 : score >= 1 ? 1 : 2;
  fameCache.set(playerId, fame);
  return fame;
}

/** Año en el que un jugador estaba en activo (primera etapa + 5, o nacimiento + 25). */
function primeYear(d: Data, playerId: number): number | null {
  const first = (d.spellsByPlayer.get(playerId) ?? [])
    .map((s) => s.start_year)
    .filter((y): y is number => y != null)
    .sort((a, b) => a - b)[0];
  if (first) return first + 5;
  const born = d.players.get(playerId)?.birth_date;
  return born ? Number(born.slice(0, 4)) + 25 : null;
}
const pick = <T>(arr: T[], n: number, rnd: () => number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]!);
  return out;
};
const unique = <T, K>(arr: T[], key: (t: T) => K): T[] => {
  const seen = new Set<K>();
  return arr.filter((t) => (seen.has(key(t)) ? false : (seen.add(key(t)), true)));
};
const money = (n: number) => `${Math.round(n / 1_000_000)} M€`;
const POSITIONS: Record<string, string> = { GK: "portero", DF: "defensa", MF: "centrocampista", FW: "delantero" };

/** Nombre de la competición tal y como se nombra en una pregunta. */
function competitionLabel(d: Data, competitionId: number, seasonLabel: string): { name: string; category: string } {
  const c = d.competitions.get(competitionId)!;
  const y = yearOf(seasonLabel);
  switch (c.slug) {
    case "mundial":
      return { name: `el Mundial de ${seasonLabel}`, category: "mundial" };
    case "eurocopa":
      return { name: `la Eurocopa de ${seasonLabel}`, category: "eurocopa" };
    case "champions-league":
      return { name: y >= 1992 ? `la Champions League ${seasonLabel}` : `la Copa de Europa ${seasonLabel}`, category: "champions" };
    default:
      return { name: `${c.name} ${seasonLabel}`, category: c.type === "league" ? "liga" : "champions" };
  }
}

function finalOf(d: Data, seasonId: number): Match | undefined {
  const finals = d.matches.filter((m) => m.season_id === seasonId && /^final/i.test(m.stage ?? ""));
  // Si hubo desempate, la final "de verdad" es el último partido.
  return finals.sort((a, b) => (a.match_date ?? "").localeCompare(b.match_date ?? "")).at(-1);
}

function goalsText(d: Data, m: Match): string {
  const goals = d.goalsByMatch.get(m.id) ?? [];
  if (!goals.length) return "";
  const byTeam = new Map<number, string[]>();
  for (const g of [...goals].sort((a, b) => a.minute - b.minute || (a.added_time ?? 0) - (b.added_time ?? 0))) {
    const p = d.players.get(g.player_id)!;
    const minute = `${g.minute}${g.added_time ? `+${g.added_time}` : ""}'`;
    const tag = g.penalty ? " (p.)" : g.own_goal ? " (p.p.)" : "";
    const list = byTeam.get(g.team_id) ?? [];
    list.push(`${p.known_as} ${minute}${tag}`);
    byTeam.set(g.team_id, list);
  }
  return [...byTeam].map(([t, l]) => `${d.teams.get(t)!.short_name ?? d.teams.get(t)!.name}: ${l.join(", ")}`).join(" · ");
}

function scoreLabel(hg: number, ag: number, extra: boolean | null, pens: string | null): string {
  if (pens) return `${hg}-${ag} (penaltis)`;
  if (extra) return `${hg}-${ag} (prórroga)`;
  return `${hg}-${ag}`;
}

function teamLabel(t: Team): string {
  return t.short_name ?? t.name;
}

function playerAccepted(d: Data, p: Player): string[] {
  const out = new Set<string>([p.known_as, p.full_name, ...(d.aliasesByPlayer.get(p.id) ?? [])]);
  const lastKnown = p.known_as.split(" ").at(-1)!;
  const lastFull = p.full_name.split(" ").at(-1)!;
  if (lastKnown.length >= 4) out.add(lastKnown);
  if (lastFull.length >= 4) out.add(lastFull);
  return [...out].map(normalizeAnswer).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------
type Template = (d: Data) => Generated[];

const competitionChampion: Template = (d) => {
  const out: Generated[] = [];
  for (const s of d.seasons.values()) {
    const winners = d.winnersBySeason.get(s.id) ?? [];
    const champ = winners.find((w) => w.final_rank === 1);
    if (!champ) continue;
    const runner = winners.find((w) => w.final_rank === 2);
    const { name, category } = competitionLabel(d, s.competition_id, s.label);
    const y = yearOf(s.label);
    const rnd = seededRandom(`champion:${s.slug}`);
    const nearby = unique(
      [...d.seasons.values()]
        .filter((o) => o.competition_id === s.competition_id && o.id !== s.id && Math.abs(yearOf(o.label) - y) <= 14)
        .flatMap((o) => d.winnersBySeason.get(o.id) ?? [])
        .map((w) => w.team_id)
        .filter((t) => t !== champ.team_id && t !== runner?.team_id),
      (t) => t,
    );
    const distractors = [...(runner ? [runner.team_id] : []), ...pick(nearby, runner ? 2 : 3, rnd)];
    if (distractors.length < 2) continue;
    const isNational = d.teams.get(champ.team_id)!.type === "national";
    const final = finalOf(d, s.id);
    const explanation = final
      ? `Final: ${teamLabel(d.teams.get(final.home_team_id)!)} ${scoreLabel(final.home_goals!, final.away_goals!, final.extra_time, final.penalties)} ${teamLabel(d.teams.get(final.away_team_id)!)}${final.venue ? ` (${final.venue})` : ""}.`
      : runner
        ? `Subcampeón: ${teamLabel(d.teams.get(runner.team_id)!)}.`
        : `${teamLabel(d.teams.get(champ.team_id)!)} ganó ${name}.`;
    out.push({
      key: "competition_champion",
      ref: s.slug,
      kind: "quiz",
      format: "multiple_choice",
      category,
      competitionId: s.competition_id,
      // Los campeones del Mundial y la Eurocopa se recuerdan mejor que los de clubes.
      difficulty: level(Math.max(0, eraLevel(y) - (isNational ? 1 : 0))),
      era: [y, y],
      prompt: `¿Qué ${isNational ? "selección" : "equipo"} ganó ${name}?`,
      explanation,
      options: [champ.team_id, ...distractors].map((t) => ({ label: teamLabel(d.teams.get(t)!), correct: t === champ.team_id, teamId: t })),
      entities: { teams: [champ.team_id, ...distractors], competitions: [s.competition_id] },
      source: champ.source_url ?? s.source_url ?? "",
    });
  }
  return out;
};

const competitionRunnerUp: Template = (d) => {
  const out: Generated[] = [];
  for (const s of d.seasons.values()) {
    const winners = d.winnersBySeason.get(s.id) ?? [];
    const champ = winners.find((w) => w.final_rank === 1);
    const runner = winners.find((w) => w.final_rank === 2);
    if (!champ || !runner) continue;
    const c = d.competitions.get(s.competition_id)!;
    if (c.type === "league") continue;
    const { name, category } = competitionLabel(d, s.competition_id, s.label);
    const y = yearOf(s.label);
    const rnd = seededRandom(`runner:${s.slug}`);
    const nearby = unique(
      [...d.seasons.values()]
        .filter((o) => o.competition_id === s.competition_id && o.id !== s.id && Math.abs(yearOf(o.label) - y) <= 14)
        .flatMap((o) => d.winnersBySeason.get(o.id) ?? [])
        .map((w) => w.team_id)
        .filter((t) => t !== champ.team_id && t !== runner.team_id),
      (t) => t,
    );
    const distractors = [champ.team_id, ...pick(nearby, 2, rnd)];
    if (distractors.length < 3) continue;
    const final = finalOf(d, s.id);
    out.push({
      key: "competition_runner_up",
      ref: s.slug,
      kind: "quiz",
      format: "multiple_choice",
      category,
      competitionId: s.competition_id,
      difficulty: level(1, eraLevel(y)),
      era: [y, y],
      prompt: `¿Quién perdió la final de ${name}?`,
      explanation: final
        ? `${teamLabel(d.teams.get(champ.team_id)!)} ganó ${scoreLabel(final.home_goals!, final.away_goals!, final.extra_time, final.penalties)}${final.venue ? ` en ${final.venue}` : ""}.`
        : `El campeón fue ${teamLabel(d.teams.get(champ.team_id)!)}.`,
      options: [runner.team_id, ...distractors].map((t) => ({ label: teamLabel(d.teams.get(t)!), correct: t === runner.team_id, teamId: t })),
      entities: { teams: [runner.team_id, ...distractors], competitions: [s.competition_id] },
      source: runner.source_url ?? s.source_url ?? "",
    });
  }
  return out;
};

const SCORES = ["1-0", "2-0", "2-1", "3-0", "3-1", "3-2", "4-0", "4-1", "4-2", "0-0", "1-1", "2-2", "3-3"];

const finalScore: Template = (d) => {
  const out: Generated[] = [];
  for (const m of d.matches) {
    if (!/^final/i.test(m.stage ?? "") || m.home_goals == null || m.away_goals == null || !m.season_id) continue;
    const s = d.seasons.get(m.season_id)!;
    const { name, category } = competitionLabel(d, s.competition_id, s.label);
    const home = d.teams.get(m.home_team_id)!;
    const away = d.teams.get(m.away_team_id)!;
    const real = scoreLabel(m.home_goals, m.away_goals, m.extra_time, m.penalties);
    const rnd = seededRandom(`score:${m.slug}`);
    const alternatives = SCORES.filter((sc) => sc !== `${m.home_goals}-${m.away_goals}`).map((sc) => {
      const [h, a] = sc.split("-").map(Number) as [number, number];
      return h === a ? `${sc} (penaltis)` : rnd() < 0.25 ? `${sc} (prórroga)` : sc;
    });
    const y = yearOf(s.label);
    const label = m.stage && /desempate/i.test(m.stage) ? `el desempate de la final de ${name}` : `la final de ${name}`;
    out.push({
      key: "final_score",
      ref: m.slug,
      kind: "quiz",
      format: "multiple_choice",
      category,
      competitionId: s.competition_id,
      difficulty: level(1, eraLevel(y)),
      era: [y, y],
      prompt: `¿Cómo terminó ${label}, ${teamLabel(home)} - ${teamLabel(away)}?`,
      explanation: [goalsText(d, m), m.venue ? `Estadio: ${m.venue}.` : ""].filter(Boolean).join(" ") || `${teamLabel(home)} ${real} ${teamLabel(away)}.`,
      options: [real, ...pick(alternatives, 3, rnd)].map((l) => ({ label: l, correct: l === real })),
      entities: { teams: [m.home_team_id, m.away_team_id], competitions: [s.competition_id] },
      source: m.source_url ?? "",
    });
  }
  return out;
};

/** Goleadores (no en propia puerta) de otras finales de la misma competición, para distraer. */
function otherFinalScorers(d: Data, m: Match, competitionId: number, year: number): number[] {
  const scorersHere = new Set((d.goalsByMatch.get(m.id) ?? []).map((g) => g.player_id));
  const lineupHere = new Set((d.lineupsByMatch.get(m.id) ?? []).map((l) => l.player_id));
  return unique(
    d.matches
      .filter((o) => o.id !== m.id && o.season_id && d.seasons.get(o.season_id)!.competition_id === competitionId)
      .filter((o) => Math.abs(yearOf(d.seasons.get(o.season_id!)!.label) - year) <= 12)
      .flatMap((o) => d.goalsByMatch.get(o.id) ?? [])
      .filter((g) => !g.own_goal && !scorersHere.has(g.player_id) && !lineupHere.has(g.player_id))
      .map((g) => g.player_id),
    (p) => p,
  );
}

const finalScorer: Template = (d) => {
  const out: Generated[] = [];
  for (const m of d.matches) {
    if (!/^final/i.test(m.stage ?? "") || !m.season_id) continue;
    const goals = (d.goalsByMatch.get(m.id) ?? []).filter((g) => !g.own_goal);
    if (!goals.length) continue;
    const s = d.seasons.get(m.season_id)!;
    const { name, category } = competitionLabel(d, s.competition_id, s.label);
    const y = yearOf(s.label);
    const rnd = seededRandom(`scorer:${m.slug}`);
    const scorers = unique(goals.map((g) => g.player_id), (p) => p);
    const correct = pick(scorers, 1, rnd)[0]!;
    const distractors = pick(otherFinalScorers(d, m, s.competition_id, y), 3, rnd);
    if (distractors.length < 3) continue;
    const single = scorers.length === 1;
    out.push({
      key: "final_scorer",
      ref: m.slug,
      kind: "quiz",
      format: "multiple_choice",
      category,
      competitionId: s.competition_id,
      difficulty: level(eraLevel(y), fameOf(d, correct), single ? 0 : -1),
      era: [y, y],
      prompt: single ? `¿Quién marcó el único gol de la final de ${name}?` : `¿Cuál de estos jugadores marcó en la final de ${name}?`,
      explanation: goalsText(d, m),
      options: [correct, ...distractors].map((p) => ({ label: d.players.get(p)!.known_as, correct: p === correct, playerId: p })),
      entities: { players: [correct, ...distractors], teams: [m.home_team_id, m.away_team_id], competitions: [s.competition_id] },
      source: goals[0]!.source_url ?? m.source_url ?? "",
    });
  }
  return out;
};

const firstScorer: Template = (d) => {
  const out: Generated[] = [];
  for (const m of d.matches) {
    if (!/^final/i.test(m.stage ?? "") || !m.season_id) continue;
    const goals = [...(d.goalsByMatch.get(m.id) ?? [])].sort((a, b) => a.minute - b.minute || (a.added_time ?? 0) - (b.added_time ?? 0));
    const scorers = unique(goals.filter((g) => !g.own_goal).map((g) => g.player_id), (p) => p);
    if (goals.length < 2 || scorers.length < 2 || goals[0]!.own_goal) continue;
    const first = goals[0]!.player_id;
    const s = d.seasons.get(m.season_id)!;
    const { name, category } = competitionLabel(d, s.competition_id, s.label);
    const y = yearOf(s.label);
    const rnd = seededRandom(`first:${m.slug}`);
    const others = scorers.filter((p) => p !== first);
    const distractors = [...pick(others, 2, rnd), ...pick(otherFinalScorers(d, m, s.competition_id, y), 3, rnd)].slice(0, 3);
    if (distractors.length < 3) continue;
    out.push({
      key: "first_scorer",
      ref: m.slug,
      kind: "quiz",
      format: "multiple_choice",
      category,
      competitionId: s.competition_id,
      difficulty: level(1, eraLevel(y), fameOf(d, first)),
      era: [y, y],
      prompt: `¿Quién abrió el marcador en la final de ${name}?`,
      explanation: goalsText(d, m),
      options: [first, ...distractors].map((p) => ({ label: d.players.get(p)!.known_as, correct: p === first, playerId: p })),
      entities: { players: [first, ...distractors], teams: [m.home_team_id, m.away_team_id], competitions: [s.competition_id] },
      source: goals[0]!.source_url ?? m.source_url ?? "",
    });
  }
  return out;
};

function awardLabel(slug: string, year: string): string {
  switch (slug) {
    case "balon-de-oro":
      return `el Balón de Oro de ${year}`;
    case "fifa-world-player":
      return `el FIFA World Player de ${year}`;
    case "the-best-fifa":
      return `el premio The Best de la FIFA de ${year}`;
    case "bota-de-oro":
      return `la Bota de Oro ${year}`;
    default:
      return `el premio ${slug} de ${year}`;
  }
}

const awardWinnerYear: Template = (d) => {
  const out: Generated[] = [];
  for (const a of d.awards.values()) {
    const rows = d.awardWinners.filter((w) => w.award_id === a.id && w.player_id);
    const byYear = Map.groupBy(rows, (w) => w.year_label);
    for (const [year, list] of byYear) {
      const winner = list.find((w) => w.rank === 1);
      if (!winner) continue;
      const y = yearOf(year);
      const rnd = seededRandom(`award:${a.slug}:${year}`);
      const podium = list.filter((w) => w.rank > 1).sort((x, z) => x.rank - z.rank).map((w) => w.player_id!);
      const nearby = unique(
        rows.filter((w) => w.rank === 1 && Math.abs(yearOf(w.year_label) - y) <= 6 && w.player_id !== winner.player_id).map((w) => w.player_id!),
        (p) => p,
      ).filter((p) => !podium.includes(p));
      const distractors = unique([...podium, ...pick(nearby, 3, rnd)], (p) => p).slice(0, 3);
      if (distractors.length < 2) continue;
      const podiumText = list
        .sort((x, z) => x.rank - z.rank)
        .map((w) => `${w.rank}. ${d.players.get(w.player_id!)!.known_as}`)
        .join(", ");
      out.push({
        key: "award_winner_year",
        ref: `${a.slug}:${year}`,
        kind: "quiz",
        format: "multiple_choice",
        category: "premios",
        difficulty: level(eraLevel(y), a.slug === "balon-de-oro" ? 0 : 1),
        era: [y, y],
        prompt: `¿Quién ganó ${awardLabel(a.slug, year)}?`,
        explanation: list.length > 1 ? `Podio: ${podiumText}.` : `${d.players.get(winner.player_id!)!.known_as} ganó ${awardLabel(a.slug, year)}.`,
        options: [winner.player_id!, ...distractors].map((p) => ({ label: d.players.get(p)!.known_as, correct: p === winner.player_id, playerId: p })),
        entities: { players: [winner.player_id!, ...distractors] },
        source: winner.source_url ?? a.source_url ?? "",
      });
    }
  }
  return out;
};

const awardCount: Template = (d) => {
  const out: Generated[] = [];
  const a = [...d.awards.values()].find((x) => x.slug === "balon-de-oro");
  if (!a) return out;
  const wins = Map.groupBy(d.awardWinners.filter((w) => w.award_id === a.id && w.rank === 1 && w.player_id), (w) => w.player_id!);
  for (const [playerId, list] of wins) {
    if (list.length < 2) continue;
    const p = d.players.get(playerId)!;
    const n = list.length;
    const rnd = seededRandom(`awardcount:${p.slug}`);
    const candidates = [n - 2, n - 1, n + 1, n + 2, n + 3].filter((x) => x >= 1 && x !== n);
    const distractors = pick(candidates, 3, rnd);
    const years = list.map((w) => w.year_label).sort().join(", ");
    out.push({
      key: "award_count",
      ref: p.slug,
      kind: "quiz",
      format: "multiple_choice",
      category: "premios",
      difficulty: level(n >= 5 ? 0 : 1, eraLevel(primeYear(d, playerId))),
      prompt: `¿Cuántos Balones de Oro ha ganado ${p.known_as}?`,
      explanation: `${n}: ${years}.`,
      options: [n, ...distractors].map((x) => ({ label: String(x), correct: x === n })),
      entities: { players: [playerId] },
      source: list[0]!.source_url ?? a.source_url ?? "",
    });
  }
  return out;
};

const clubBeforeTransfer: Template = (d) => {
  const out: Generated[] = [];
  const clubIds = [...d.teams.values()].filter((t) => t.type === "club").map((t) => t.id);
  for (const t of d.transfers) {
    if (!t.from_team_id || !t.to_team_id || !t.transfer_year) continue;
    const from = d.teams.get(t.from_team_id)!;
    const to = d.teams.get(t.to_team_id)!;
    if (from.type !== "club" || to.type !== "club") continue;
    const p = d.players.get(t.player_id)!;
    const played = new Set((d.spellsByPlayer.get(p.id) ?? []).map((s) => s.team_id));
    const rnd = seededRandom(`before:${p.slug}:${to.slug}:${t.transfer_year}`);
    const pool = clubIds.filter((c) => c !== from.id && c !== to.id && !played.has(c));
    // Preferir clubes del mismo país que el de origen (opciones de la misma clase).
    const sameCountry = pool.filter((c) => d.teams.get(c)!.country_code === from.country_code);
    const distractors = unique([...pick(sameCountry, 2, rnd), ...pick(pool, 3, rnd)], (c) => c).slice(0, 3);
    if (distractors.length < 3) continue;
    out.push({
      key: "club_before_transfer",
      ref: `${p.slug}:${to.slug}:${t.transfer_year}`,
      kind: "quiz",
      format: "multiple_choice",
      category: "fichajes",
      difficulty: level(eraLevel(t.transfer_year), fameOf(d, p.id)),
      era: [t.transfer_year, t.transfer_year],
      prompt: `¿De qué club llegó ${p.known_as} al ${teamLabel(to)} en ${t.transfer_year}?`,
      explanation: t.fee_amount
        ? `Fichó por unos ${money(Number(t.fee_amount))}${t.fee_is_estimate ? " (cifra estimada)" : ""}.`
        : `${p.known_as} pasó del ${teamLabel(from)} al ${teamLabel(to)} en ${t.transfer_year}.`,
      options: [from.id, ...distractors].map((c) => ({ label: teamLabel(d.teams.get(c)!), correct: c === from.id, teamId: c })),
      entities: { players: [p.id], teams: [from.id, to.id] },
      source: t.source_url ?? "",
    });
  }
  return out;
};

const transferHigherLower: Template = (d) => {
  const out: Generated[] = [];
  const withFee = d.transfers.filter((t) => t.fee_amount && Number(t.fee_amount) >= 20_000_000 && t.to_team_id && t.fee_currency === "EUR");
  const rnd = seededRandom("higher-lower:transfers");
  const seen = new Set<string>();
  const label = (t: (typeof withFee)[number]) =>
    `${d.players.get(t.player_id)!.known_as}: ${t.from_team_id ? teamLabel(d.teams.get(t.from_team_id)!) + " → " : ""}${teamLabel(d.teams.get(t.to_team_id!)!)} (${t.transfer_year ?? "?"})`;
  let attempts = 0;
  while (out.length < 160 && attempts++ < 5000) {
    const [a, b] = pick(withFee, 2, rnd) as [typeof withFee[number], typeof withFee[number]];
    if (a.player_id === b.player_id) continue;
    const fa = Number(a.fee_amount);
    const fb = Number(b.fee_amount);
    const ratio = Math.max(fa, fb) / Math.min(fa, fb);
    if (ratio < 1.06 || ratio > 3) continue;
    const ref = [a.id, b.id].sort((x, y) => x - y).join("|");
    if (seen.has(ref)) continue;
    seen.add(ref);
    const [hi, lo] = fa > fb ? [a, b] : [b, a];
    out.push({
      key: "transfer_higher_lower",
      ref,
      kind: "higher_lower",
      format: "multiple_choice",
      category: "fichajes",
      difficulty: level(ratio > 1.6 ? 0 : ratio > 1.25 ? 1 : 2, eraLevel(Math.min(a.transfer_year ?? 2000, b.transfer_year ?? 2000)) > 1 ? 1 : 0),
      prompt: "¿Qué fichaje fue más caro?",
      explanation: `${d.players.get(hi.player_id)!.known_as}: ${money(Number(hi.fee_amount))} · ${d.players.get(lo.player_id)!.known_as}: ${money(Number(lo.fee_amount))}${hi.fee_is_estimate || lo.fee_is_estimate ? " (cifras aprox.)" : ""}.`,
      options: [a, b].map((t) => ({ label: label(t), correct: t.id === hi.id, playerId: t.player_id })),
      entities: { players: [a.player_id, b.player_id], teams: [a.to_team_id!, b.to_team_id!] },
      source: hi.source_url ?? lo.source_url ?? "",
    });
  }
  return out;
};

const playedBothClubs: Template = (d) => {
  const out: Generated[] = [];
  const clubsByPlayer = new Map<number, Set<number>>();
  for (const [pid, spells] of d.spellsByPlayer) {
    const clubs = new Set(spells.map((s) => s.team_id).filter((t) => d.teams.get(t)!.type === "club"));
    if (clubs.size) clubsByPlayer.set(pid, clubs);
  }
  // Parejas de clubes con al menos 4 jugadores en común.
  const pairCount = new Map<string, number[]>();
  for (const [pid, clubs] of clubsByPlayer) {
    const list = [...clubs].sort((a, b) => a - b);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const k = `${list[i]}|${list[j]}`;
        pairCount.set(k, [...(pairCount.get(k) ?? []), pid]);
      }
  }
  for (const [k, shared] of pairCount) {
    if (shared.length < 4) continue;
    const [a, b] = k.split("|").map(Number) as [number, number];
    const ta = d.teams.get(a)!;
    const tb = d.teams.get(b)!;
    const onlyOne = [...clubsByPlayer].filter(([, c]) => c.has(a) !== c.has(b)).map(([pid]) => pid);
    if (onlyOne.length < 6) continue;
    const rnd = seededRandom(`both:${k}`);
    for (const correct of shared) {
      const distractors = pick(onlyOne, 3, rnd);
      const p = d.players.get(correct)!;
      out.push({
        key: "played_both_clubs",
        ref: `${ta.slug}|${tb.slug}:${p.slug}`,
        kind: "quiz",
        format: "multiple_choice",
        category: "leyendas",
        difficulty: level(eraLevel(primeYear(d, correct)), fameOf(d, correct)),
        prompt: `¿Cuál de estos jugadores jugó en el ${teamLabel(ta)} y en el ${teamLabel(tb)}?`,
        explanation: `${p.known_as}: ${(d.spellsByPlayer.get(correct) ?? [])
          .filter((s) => s.team_id === a || s.team_id === b)
          .sort((x, y) => (x.start_year ?? 0) - (y.start_year ?? 0))
          .map((s) => `${teamLabel(d.teams.get(s.team_id)!)} ${s.start_year ?? "?"}-${s.end_year ?? "…"}${s.is_loan ? " (cesión)" : ""}`)
          .join(", ")}.`,
        options: [correct, ...distractors].map((pid) => ({ label: d.players.get(pid)!.known_as, correct: pid === correct, playerId: pid })),
        entities: { players: [correct, ...distractors], teams: [a, b] },
        source: p.source_url ?? "",
      });
    }
  }
  return out;
};

const playerNationality: Template = (d) => {
  const out: Generated[] = [];
  for (const p of d.players.values()) {
    if (!p.nationality || p.second_nationality) continue;
    const spells = d.spellsByPlayer.get(p.id) ?? [];
    const awards = d.awardWinners.filter((w) => w.player_id === p.id).length;
    if (spells.length < 2 && !awards) continue;  // solo fichas con algo de recorrido
    const c = d.countries.get(p.nationality)!;
    const rnd = seededRandom(`nat:${p.slug}`);
    const same = [...d.countries.values()].filter((x) => x.code !== c.code && x.confederation === c.confederation).map((x) => x.code);
    const distractors = pick(same, 3, rnd);
    if (distractors.length < 3) continue;
    const clubs = unique(spells.map((s) => s.team_id).filter((t) => d.teams.get(t)!.type === "club"), (t) => t)
      .slice(0, 3)
      .map((t) => teamLabel(d.teams.get(t)!));
    out.push({
      key: "player_nationality",
      ref: p.slug,
      kind: "quiz",
      format: "multiple_choice",
      category: "leyendas",
      difficulty: level(eraLevel(primeYear(d, p.id)), fameOf(d, p.id)),
      prompt: `¿De qué país es ${p.known_as}?`,
      explanation: `${p.full_name}${p.birth_date ? ` (${p.birth_date.slice(0, 4)})` : ""}${clubs.length ? `, jugó en ${clubs.join(", ")}` : ""}.`,
      options: [c.code, ...distractors].map((code) => ({ label: d.countries.get(code)!.name_es, correct: code === c.code })),
      entities: { players: [p.id] },
      source: p.source_url ?? "",
    });
  }
  return out;
};

const recordHolder: Template = (d) => {
  const out: Generated[] = [];
  for (const r of d.records) {
    if (!r.player_id && !r.team_id) continue;
    const rnd = seededRandom(`record:${r.id}`);
    let options: Option[];
    let entities: Generated["entities"];
    if (r.player_id) {
      const p = d.players.get(r.player_id)!;
      const pool = [...d.players.values()].filter((x) => x.id !== p.id && x.position === p.position && d.awardWinners.some((w) => w.player_id === x.id));
      const distractors = pick(pool.length >= 3 ? pool : [...d.players.values()].filter((x) => x.id !== p.id && d.awardWinners.some((w) => w.player_id === x.id)), 3, rnd);
      if (distractors.length < 3) continue;
      options = [p, ...distractors].map((x) => ({ label: x.known_as, correct: x.id === p.id, playerId: x.id }));
      entities = { players: [p.id, ...distractors.map((x) => x.id)] };
    } else {
      const t = d.teams.get(r.team_id!)!;
      const pool = [...d.teams.values()].filter((x) => x.id !== t.id && x.type === t.type && d.winnersBySeason.size && [...d.winnersBySeason.values()].some((ws) => ws.some((w) => w.team_id === x.id)));
      const distractors = pick(pool, 3, rnd);
      if (distractors.length < 3) continue;
      options = [t, ...distractors].map((x) => ({ label: teamLabel(x), correct: x.id === t.id, teamId: x.id }));
      entities = { teams: [t.id, ...distractors.map((x) => x.id)] };
    }
    out.push({
      key: "record_holder",
      ref: String(r.id),
      kind: "quiz",
      format: "multiple_choice",
      category: "records",
      difficulty: level(r.player_id ? fameOf(d, r.player_id) : 0),
      prompt: `${r.title}: ¿quién tiene el récord?`,
      explanation: [r.value_text, r.description].filter(Boolean).join(". ") + (r.still_standing ? "" : " (récord ya superado)"),
      options,
      entities,
      source: r.source_url ?? "",
    });
  }
  return out;
};

/** Clubes de un jugador en orden cronológico, unidos si son etapas seguidas del mismo club. */
function careerClubs(d: Data, playerId: number): { team: Team; from: number | null; to: number | null; loan: boolean }[] {
  const spells = (d.spellsByPlayer.get(playerId) ?? [])
    .filter((s) => d.teams.get(s.team_id)!.type === "club")
    .sort((a, b) => (a.start_year ?? 0) - (b.start_year ?? 0));
  const out: { team: Team; from: number | null; to: number | null; loan: boolean }[] = [];
  for (const s of spells) {
    const last = out.at(-1);
    if (last && last.team.id === s.team_id && last.loan === s.is_loan) {
      last.to = s.end_year;
      continue;
    }
    out.push({ team: d.teams.get(s.team_id)!, from: s.start_year, to: s.end_year, loan: s.is_loan });
  }
  return out;
}

const guessPlayer: Template = (d) => {
  const out: Generated[] = [];
  for (const p of d.players.values()) {
    if (!p.nationality || !p.birth_date || !p.position) continue;
    const clubs = careerClubs(d, p.id);
    if (unique(clubs, (c) => c.team.id).length < 3) continue;
    const awards = d.awardWinners.filter((w) => w.player_id === p.id && w.rank === 1);
    const country = d.countries.get(p.nationality)!;
    const first = clubs[0]!;
    const longest = [...clubs].filter((c) => c.team.id !== first.team.id).sort((a, b) => ((b.to ?? 2026) - (b.from ?? 0)) - ((a.to ?? 2026) - (a.from ?? 0)))[0];
    const clues = [
      `Nació en ${p.birth_date.slice(0, 4)} y ${p.retired === false ? "juega" : "jugó"} de ${POSITIONS[p.position] ?? p.position}.`,
      `Su primer club profesional fue el ${teamLabel(first.team)}${first.from ? ` (${first.from})` : ""}.`,
      `Es ${country.name_es === "España" ? "español" : `de ${country.name_es}`}.`,
      longest ? `Jugó varios años en el ${teamLabel(longest.team)}.` : `Pasó por ${clubs.length} clubes.`,
      awards.length
        ? `Ganó ${awardLabel(d.awards.get(awards[0]!.award_id)!.slug, awards[0]!.year_label)}.`
        : `Pasó por ${unique(clubs, (c) => c.team.id).length} clubes distintos.`,
      `Sus iniciales son ${p.full_name.split(" ").filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w)).map((w) => w[0] + ".").join(" ")}`,
    ];
    out.push({
      key: "guess_player",
      ref: p.slug,
      kind: "guess_player",
      format: "free_text",
      category: "leyendas",
      difficulty: level(fameOf(d, p.id), eraLevel(primeYear(d, p.id))),
      prompt: "¿Quién es este jugador? Pide pistas si las necesitas: cuantas menos uses, más puntos.",
      explanation: `${p.full_name}: ${clubs.map((c) => `${teamLabel(c.team)}${c.loan ? " (cesión)" : ""}`).join(" → ")}.`,
      options: [{ label: p.known_as, correct: true, playerId: p.id }],
      accepted: playerAccepted(d, p),
      clues,
      entities: { players: [p.id], teams: clubs.map((c) => c.team.id) },
      source: p.source_url ?? "",
    });
  }
  return out;
};

const careerPath: Template = (d) => {
  const out: Generated[] = [];
  for (const p of d.players.values()) {
    const clubs = careerClubs(d, p.id);
    if (unique(clubs, (c) => c.team.id).length < 4) continue;
    const clues = clubs.map((c) => `${teamLabel(c.team)}${c.loan ? " (cesión)" : ""}${c.from ? ` · ${c.from}${c.to ? `-${c.to}` : ""}` : ""}`);
    if (p.nationality && p.position) {
      clues.push(`Pista extra: ${POSITIONS[p.position] ?? p.position} de ${d.countries.get(p.nationality)!.name_es}.`);
    }
    out.push({
      key: "career_path",
      ref: p.slug,
      kind: "career_path",
      format: "free_text",
      category: "trayectorias",
      difficulty: level(fameOf(d, p.id), eraLevel(primeYear(d, p.id))),
      prompt: "¿Qué jugador siguió esta trayectoria? Cada pista es su siguiente club.",
      explanation: `${p.full_name}${p.nationality ? ` (${d.countries.get(p.nationality)!.name_es})` : ""}: ${clubs.map((c) => teamLabel(c.team)).join(" → ")}.`,
      options: [{ label: p.known_as, correct: true, playerId: p.id }],
      accepted: playerAccepted(d, p),
      clues: clues.slice(0, 10),
      entities: { players: [p.id], teams: clubs.map((c) => c.team.id) },
      source: p.source_url ?? "",
    });
  }
  return out;
};

export const TEMPLATES: Record<string, Template> = {
  competition_champion: competitionChampion,
  competition_runner_up: competitionRunnerUp,
  final_score: finalScore,
  final_scorer: finalScorer,
  first_scorer: firstScorer,
  award_winner_year: awardWinnerYear,
  award_count: awardCount,
  club_before_transfer: clubBeforeTransfer,
  transfer_higher_lower: transferHigherLower,
  played_both_clubs: playedBothClubs,
  player_nationality: playerNationality,
  record_holder: recordHolder,
  guess_player: guessPlayer,
  career_path: careerPath,
};

/** "de el Mundial" → "del Mundial", "a el" → "al" (los nombres de competición llevan artículo). */
export const contractions = (t: string) => t.replace(/\bde el\b/g, "del").replace(/\ba el\b/g, "al");

/** Comprobaciones de calidad: una sola correcta, sin opciones repetidas, fuente, longitud. */
export function validate(q: Generated): string[] {
  const errors: string[] = [];
  if (!q.source) errors.push("sin fuente");
  if (q.prompt.length > 140) errors.push(`enunciado largo (${q.prompt.length})`);
  if (q.options.filter((o) => o.correct).length !== 1) errors.push("debe haber exactamente una correcta");
  if (new Set(q.options.map((o) => o.label.toLowerCase())).size !== q.options.length) errors.push("opciones repetidas");
  if (q.format === "multiple_choice" && q.kind !== "higher_lower" && q.options.length < 3) errors.push("menos de 3 opciones");
  if (q.format === "free_text" && !(q.accepted?.length && q.clues?.length)) errors.push("texto libre sin respuestas aceptadas o sin pistas");
  if (q.options.some((o) => !o.label.trim())) errors.push("opción vacía");
  return errors;
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------
await main();

async function main() {
  const { url, key } = loadEnv();
  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log(`Leyendo datos de ${new URL(url).host}…`);
  const data = await loadData(db);
  console.log(`  ${data.players.size} jugadores, ${data.teams.size} equipos, ${data.seasons.size} ediciones, ${data.matches.length} partidos, ${data.transfers.length} fichajes`);

  const keys = Object.keys(TEMPLATES).filter((k) => !only || k === only);
  if (only && !keys.length) {
    console.error(`Plantilla desconocida: ${only}. Disponibles: ${Object.keys(TEMPLATES).join(", ")}`);
    process.exit(1);
  }

  const generated: Generated[] = [];
  const invalid: string[] = [];
  for (const k of keys) {
    const list = TEMPLATES[k]!(data);
    let ok = 0;
    for (const q of list) {
      q.prompt = contractions(q.prompt);
      q.explanation = contractions(q.explanation);
      const errs = validate(q);
      if (errs.length) invalid.push(`${k}/${q.ref}: ${errs.join(", ")}`);
      else {
        generated.push(q);
        ok++;
      }
    }
    console.log(`  ${k}: ${ok}${list.length - ok ? ` (${list.length - ok} descartadas)` : ""}`);
    if (flag("--simular") && list[0]) {
      const q = list[Math.floor(list.length / 2)]!;
      console.log(`      ej.: ${q.prompt}`);
      console.log(`           ${q.options.map((o) => (o.correct ? `[${o.label}]` : o.label)).join(" / ")}`);
      if (q.clues) console.log(`           pistas: ${q.clues.join(" | ")}`);
      console.log(`           → ${q.explanation}`);
    }
  }
  for (const i of invalid.slice(0, 20)) console.log("  descartada:", i);
  console.log(`\nTotal generadas: ${generated.length}`);
  if (flag("--simular")) return;

  const status = flag("--publicar") ? "published" : "review";
  await save(db, data, generated, keys, status, flag("--regenerar"));
}

function loadEnv() {
  const envFile = resolve("apps/web/.env.local");
  if (!process.env.SUPABASE_SECRET_KEY && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (entorno o apps/web/.env.local).");
    process.exit(1);
  }
  return { url, key };
}

async function save(db: SupabaseClient, data: Data, list: Generated[], keys: string[], status: string, regenerate: boolean) {
  if (regenerate) {
    // Las generadas antes pasan a `retired` y liberan su generator_ref.
    const { data: old, error } = await db.from("questions").select("id, generator_ref").in("generator_key", keys).not("generator_ref", "like", "%#retirada-%");
    if (error) throw new Error(error.message);
    for (const q of old ?? []) {
      const { error: e } = await db.from("questions").update({ status: "retired", generator_ref: `${q.generator_ref}#retirada-${q.id}` }).eq("id", q.id);
      if (e) throw new Error(e.message);
    }
    console.log(`Retiradas ${old?.length ?? 0} preguntas generadas anteriormente.`);
  }

  const existing = new Map<string, { id: number; difficulty: number }>();
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await db
      .from("questions")
      .select("id, generator_key, generator_ref, difficulty")
      .in("generator_key", keys)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of rows ?? []) existing.set(`${r.generator_key}/${r.generator_ref}`, { id: r.id, difficulty: r.difficulty });
    if ((rows?.length ?? 0) < 1000) break;
  }

  // Las que ya existen: se actualiza la dificultad si la fórmula ha cambiado.
  const changed = new Map<number, number[]>();
  for (const q of list) {
    const e = existing.get(`${q.key}/${q.ref}`);
    if (e && e.difficulty !== q.difficulty) changed.set(q.difficulty, [...(changed.get(q.difficulty) ?? []), e.id]);
  }
  for (const [difficulty, ids] of changed) {
    for (let i = 0; i < ids.length; i += 300) {
      const { error } = await db.from("questions").update({ difficulty }).in("id", ids.slice(i, i + 300));
      if (error) throw new Error(`questions (dificultad): ${error.message}`);
    }
  }
  const nChanged = [...changed.values()].reduce((n, l) => n + l.length, 0);
  if (nChanged) console.log(`Dificultad actualizada en ${nChanged} preguntas.`);
  const fresh = list.filter((q) => !existing.has(`${q.key}/${q.ref}`));
  console.log(`Ya existían ${list.length - fresh.length}; se insertan ${fresh.length} en estado "${status}".`);
  if (!fresh.length) return;

  const categories = new Map<string, number>();
  const { data: cats, error: catErr } = await db.from("question_categories").select("id, slug");
  if (catErr) throw new Error(catErr.message);
  for (const c of cats ?? []) categories.set(c.slug, c.id);

  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    const { data: rows, error } = await db
      .from("questions")
      .insert(
        chunk.map((q) => ({
          format: q.format,
          kind: q.kind,
          category_id: categories.get(q.category) ?? (() => { throw new Error(`Categoría desconocida: ${q.category}`); })(),
          competition_id: q.competitionId ?? null,
          era_from: q.era?.[0] ?? null,
          era_to: q.era?.[1] ?? null,
          difficulty: q.difficulty,
          status,
          origin: "generated",
          generator_key: q.key,
          generator_ref: q.ref,
          source_url: q.source,
          verified_at: status === "published" ? new Date().toISOString() : null,
        })),
      )
      .select("id, generator_key, generator_ref");
    if (error) throw new Error(`questions: ${error.message}`);
    const ids = new Map((rows ?? []).map((r) => [`${r.generator_key}/${r.generator_ref}`, r.id as number]));

    const translations: Record<string, unknown>[] = [];
    const options: Record<string, unknown>[] = [];
    const accepted: Record<string, unknown>[] = [];
    const clues: Record<string, unknown>[] = [];
    const entities: Record<string, unknown>[] = [];
    for (const q of chunk) {
      const id = ids.get(`${q.key}/${q.ref}`)!;
      translations.push({ question_id: id, language: "es", prompt: q.prompt, explanation: q.explanation.slice(0, 300) });
      q.options.forEach((o, idx) =>
        options.push({ question_id: id, position: idx + 1, is_correct: o.correct, player_id: o.playerId ?? null, team_id: o.teamId ?? null, _label: o.label }),
      );
      for (const a of unique(q.accepted ?? [], (x) => x)) accepted.push({ question_id: id, answer_norm: a });
      (q.clues ?? []).forEach((c, idx) => clues.push({ question_id: id, position: idx + 1, language: "es", clue: c }));
      for (const p of unique(q.entities.players ?? [], (x) => x)) entities.push({ question_id: id, player_id: p });
      for (const t of unique(q.entities.teams ?? [], (x) => x)) entities.push({ question_id: id, team_id: t });
      for (const c of unique(q.entities.competitions ?? [], (x) => x)) entities.push({ question_id: id, competition_id: c });
    }
    await insert(db, "question_translations", translations);
    const { data: optRows, error: optErr } = await db
      .from("question_options")
      .insert(options.map(({ _label, ...o }) => o))
      .select("id, question_id, position");
    if (optErr) throw new Error(`question_options: ${optErr.message}`);
    const optId = new Map((optRows ?? []).map((r) => [`${r.question_id}/${r.position}`, r.id as number]));
    await insert(
      db,
      "question_option_translations",
      options.map((o) => ({ option_id: optId.get(`${o.question_id}/${o.position}`), language: "es", label: o._label })),
    );
    await insert(db, "question_accepted_answers", accepted);
    await insert(db, "question_clues", clues);
    await insert(db, "question_entities", entities);
    inserted += chunk.length;
    console.log(`  ${inserted}/${fresh.length}`);
  }
  void data;
}

async function insert(db: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
}
