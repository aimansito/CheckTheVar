// Formato de los lotes de datos (docs/datos/plantilla-datos.json) y su validación.
import { z } from "zod";

const ref = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ref: minúsculas, números y guiones");
const countryCode = z.string().regex(/^[A-Z]{2}(-[A-Z]{3})?$/, "código de país ISO (ES) o subdivisión (GB-ENG)");
/** Fecha completa (YYYY-MM-DD) o solo el año (YYYY). */
const partialDate = z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/, "fecha YYYY-MM-DD o YYYY");
const source = z.url({ protocol: /^https?$/, error: "source: URL obligatoria" });
const opt = <T extends z.ZodType>(t: T) => t.nullish();
const int = z.number().int();

export const countrySchema = z.object({
  code: countryCode,
  name_es: z.string().min(1),
  name_en: z.string().min(1),
  confederation: opt(z.string()),
});

export const teamSchema = z.object({
  ref,
  type: z.enum(["club", "national"]),
  name: z.string().min(1),
  short_name: opt(z.string()),
  country: opt(countryCode),
  founded_year: opt(int.min(1850).max(2100)),
  source,
});

export const competitionSchema = z.object({
  ref,
  name: z.string().min(1),
  type: z.enum(["league", "cup", "continental_club", "international", "friendly", "other"]),
  country: opt(countryCode),
  tier: opt(int.positive()),
  source,
});

export const seasonSchema = z.object({
  ref,
  competition: ref,
  label: z.string().min(1),
  start_date: opt(partialDate),
  end_date: opt(partialDate),
  host_country: opt(countryCode),
  source,
});

export const competitionWinnerSchema = z.object({
  season: ref,
  team: ref,
  final_rank: int.min(1).default(1),
  source,
});

export const playerSchema = z.object({
  ref,
  full_name: z.string().min(1),
  known_as: z.string().min(1),
  aliases: z.array(z.string().min(1)).nullish(),
  birth_date: opt(partialDate),
  death_date: opt(partialDate),
  nationality: opt(countryCode),
  second_nationality: opt(countryCode),
  position: opt(z.enum(["GK", "DF", "MF", "FW"])),
  height_cm: opt(int.min(140).max(220)),
  foot: opt(z.enum(["left", "right", "both"])),
  retired: opt(z.boolean()),
  popularity: opt(int.min(0).max(100)),
  source,
});

const stat = opt(int.min(0));
export const playerSpellSchema = z
  .object({
    player: ref,
    team: ref,
    start_date: opt(partialDate),
    end_date: opt(partialDate),
    is_loan: z.boolean().default(false),
    appearances: stat,
    goals: stat,
    assists: stat,
    source,
  })
  .refine((s) => !s.start_date || !s.end_date || s.end_date.slice(0, 4) >= s.start_date.slice(0, 4), {
    message: "end_date anterior a start_date",
  });

export const transferSchema = z.object({
  player: ref,
  from_team: opt(ref),
  to_team: opt(ref),
  transfer_date: partialDate,
  type: z.enum(["transfer", "loan", "loan_return", "free", "youth_promotion", "retirement"]),
  fee_amount: opt(z.number().nonnegative()),
  fee_currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"),
  fee_is_estimate: z.boolean().default(true),
  source,
});

export const awardSchema = z.object({
  ref,
  name: z.string().min(1),
  scope: z.enum(["individual", "team"]),
  organizer: opt(z.string()),
  competition: opt(ref),
  source,
});

export const awardWinnerSchema = z
  .object({
    award: ref,
    year_label: z.string().regex(/^\d{4}(-\d{2})?$/, "año (2010) o temporada (2009-10)"),
    player: opt(ref),
    team: opt(ref),
    rank: int.min(1).default(1),
    source,
  })
  .refine((w) => w.player || w.team, { message: "award_winner sin jugador ni equipo" });

export const matchSchema = z.object({
  ref,
  season: opt(ref),
  stage: opt(z.string()),
  match_date: opt(partialDate),
  home_team: ref,
  away_team: ref,
  home_goals: opt(int.min(0)),
  away_goals: opt(int.min(0)),
  extra_time: z.boolean().default(false),
  penalties: opt(z.string().regex(/^\d+-\d+$/)),
  venue: opt(z.string()),
  scorers: z.array(z.object({ player: ref, team: ref, goals: int.min(1) })).default([]),
  source,
});

export const recordSchema = z.object({
  title: z.string().min(1),
  description: opt(z.string()),
  value_numeric: opt(z.number()),
  value_text: opt(z.string()),
  player: opt(ref),
  team: opt(ref),
  competition: opt(ref),
  achieved_on: opt(partialDate),
  still_standing: z.boolean().default(true),
  source,
});

export const matchGoalSchema = z
  .object({
    match: ref,
    minute: int.min(1).max(130),
    added_time: opt(int.min(1).max(30)),
    player: ref,
    team: ref,
    assist: opt(ref),
    penalty: z.boolean().default(false),
    own_goal: z.boolean().default(false),
    golden_goal: z.boolean().default(false),
    source,
  })
  .refine((g) => !(g.own_goal && g.assist), { message: "un autogol no tiene asistente" })
  .refine((g) => g.assist !== g.player, { message: "el asistente no puede ser el goleador" });

export const playerAliasesSchema = z.object({ player: ref, aliases: z.array(z.string().min(1)).min(1) });

export const teamSuccessorSchema = z.object({ team: ref, successor: ref, source });

export const loteSchema = z.object({
  _lote: z.unknown().optional(),
  _instrucciones: z.unknown().optional(),
  countries: z.array(countrySchema).default([]),
  teams: z.array(teamSchema).default([]),
  competitions: z.array(competitionSchema).default([]),
  seasons: z.array(seasonSchema).default([]),
  competition_winners: z.array(competitionWinnerSchema).default([]),
  players: z.array(playerSchema).default([]),
  player_spells: z.array(playerSpellSchema).default([]),
  transfers: z.array(transferSchema).default([]),
  awards: z.array(awardSchema).default([]),
  award_winners: z.array(awardWinnerSchema).default([]),
  matches: z.array(matchSchema).default([]),
  records: z.array(recordSchema).default([]),
  match_goals: z.array(matchGoalSchema).default([]),
  player_aliases: z.array(playerAliasesSchema).default([]),
  team_successors: z.array(teamSuccessorSchema).default([]),
  questions: z.array(z.unknown()).default([]),
});

export type Lote = z.infer<typeof loteSchema>;

/** Todos los lotes unidos, con cada entidad indexada por su ref. */
export interface Dataset {
  countries: Map<string, Lote["countries"][number]>;
  teams: Map<string, Lote["teams"][number]>;
  competitions: Map<string, Lote["competitions"][number]>;
  seasons: Map<string, Lote["seasons"][number]>;
  players: Map<string, Lote["players"][number]>;
  awards: Map<string, Lote["awards"][number]>;
  matches: Map<string, Lote["matches"][number]>;
  competitionWinners: Lote["competition_winners"];
  playerSpells: Lote["player_spells"];
  transfers: Lote["transfers"];
  awardWinners: Lote["award_winners"];
  records: Lote["records"];
  matchGoals: Lote["match_goals"];
  /** Alias por jugador: los de su ficha más los de las secciones player_aliases. */
  aliases: Map<string, Set<string>>;
  teamSuccessors: Lote["team_successors"];
}

export interface Report {
  errors: string[];
  warnings: string[];
}

type Keyed = "countries" | "teams" | "competitions" | "seasons" | "players" | "awards" | "matches";

/**
 * Une los lotes en orden y comprueba la integridad: refs únicos, enlaces resueltos y sin filas
 * duplicadas. Un ref repetido con los mismos datos es un aviso; con datos distintos, un error.
 */
export function buildDataset(lotes: { name: string; data: unknown }[]): { dataset: Dataset; report: Report } {
  const report: Report = { errors: [], warnings: [] };
  const ds: Dataset = {
    countries: new Map(), teams: new Map(), competitions: new Map(), seasons: new Map(),
    players: new Map(), awards: new Map(), matches: new Map(),
    competitionWinners: [], playerSpells: [], transfers: [], awardWinners: [], records: [],
    matchGoals: [], aliases: new Map(), teamSuccessors: [],
  };
  const addAliases = (player: string, list: readonly string[] | null | undefined) => {
    const set = ds.aliases.get(player) ?? new Set<string>();
    for (const a of list ?? []) set.add(a.trim());
    if (set.size) ds.aliases.set(player, set);
  };

  const define = <K extends Keyed>(kind: K, key: string, value: Dataset[K] extends Map<string, infer V> ? V : never, file: string) => {
    const map = ds[kind] as Map<string, unknown>;
    const prev = map.get(key);
    if (prev === undefined) return void map.set(key, value);
    const same = JSON.stringify(withoutSource(prev)) === JSON.stringify(withoutSource(value));
    (same ? report.warnings : report.errors).push(
      `${kind}: "${key}" definido otra vez en ${file}${same ? " (idéntico, se ignora)" : " con datos distintos"}`,
    );
  };

  for (const { name, data } of lotes) {
    const parsed = loteSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 50)) {
        report.errors.push(`${name}: ${issue.path.join(".")}: ${issue.message}`);
      }
      continue;
    }
    const l = parsed.data;
    for (const c of l.countries) define("countries", c.code, c, name);
    for (const x of l.teams) define("teams", x.ref, x, name);
    for (const x of l.competitions) define("competitions", x.ref, x, name);
    for (const x of l.seasons) define("seasons", x.ref, x, name);
    for (const x of l.players) define("players", x.ref, x, name);
    for (const x of l.awards) define("awards", x.ref, x, name);
    for (const x of l.matches) define("matches", x.ref, x, name);
    ds.competitionWinners.push(...l.competition_winners);
    ds.playerSpells.push(...l.player_spells);
    ds.transfers.push(...l.transfers);
    ds.awardWinners.push(...l.award_winners);
    ds.records.push(...l.records);
    ds.matchGoals.push(...l.match_goals);
    ds.teamSuccessors.push(...l.team_successors);
    for (const p of l.players) addAliases(p.ref, p.aliases);
    for (const a of l.player_aliases) addAliases(a.player, a.aliases);
    if (l.questions.length) report.warnings.push(`${name}: ${l.questions.length} preguntas ignoradas (aún no se importan preguntas)`);
  }

  // Enlaces: todo ref usado debe estar definido en algún lote.
  const need = (kind: Keyed, key: string | null | undefined, where: string) => {
    if (key != null && !ds[kind].has(key)) report.errors.push(`${where}: ${kind} "${key}" no está definido`);
  };
  for (const t of ds.teams.values()) need("countries", t.country, `team ${t.ref}`);
  for (const c of ds.competitions.values()) need("countries", c.country, `competition ${c.ref}`);
  for (const s of ds.seasons.values()) {
    need("competitions", s.competition, `season ${s.ref}`);
    need("countries", s.host_country, `season ${s.ref}`);
  }
  for (const p of ds.players.values()) {
    need("countries", p.nationality, `player ${p.ref}`);
    need("countries", p.second_nationality, `player ${p.ref}`);
  }
  for (const a of ds.awards.values()) need("competitions", a.competition, `award ${a.ref}`);
  for (const m of ds.matches.values()) {
    need("seasons", m.season, `match ${m.ref}`);
    need("teams", m.home_team, `match ${m.ref}`);
    need("teams", m.away_team, `match ${m.ref}`);
    if (m.scorers.length) report.warnings.push(`match ${m.ref}: goleadores aún no se importan`);
  }
  for (const w of ds.competitionWinners) {
    need("seasons", w.season, "competition_winner");
    need("teams", w.team, `competition_winner ${w.season}`);
  }
  for (const s of ds.playerSpells) {
    need("players", s.player, "player_spell");
    need("teams", s.team, `player_spell ${s.player}`);
  }
  for (const t of ds.transfers) {
    need("players", t.player, "transfer");
    need("teams", t.from_team, `transfer ${t.player}`);
    need("teams", t.to_team, `transfer ${t.player}`);
  }
  for (const w of ds.awardWinners) {
    need("awards", w.award, "award_winner");
    need("players", w.player, `award_winner ${w.award} ${w.year_label}`);
    need("teams", w.team, `award_winner ${w.award} ${w.year_label}`);
  }
  for (const r of ds.records) {
    need("players", r.player, `record "${r.title}"`);
    need("teams", r.team, `record "${r.title}"`);
    need("competitions", r.competition, `record "${r.title}"`);
  }
  for (const g of ds.matchGoals) {
    const where = `match_goal ${g.match} ${g.minute}'`;
    need("matches", g.match, where);
    need("players", g.player, where);
    need("players", g.assist, where);
    need("teams", g.team, where);
    const m = ds.matches.get(g.match);
    if (m && g.team !== m.home_team && g.team !== m.away_team) report.errors.push(`${where}: ${g.team} no jugó ese partido`);
  }
  // Los goles de cada partido deben cuadrar con su marcador.
  const byMatch = Map.groupBy(ds.matchGoals, (g) => g.match);
  for (const [ref, goals] of byMatch) {
    const m = ds.matches.get(ref);
    if (!m || m.home_goals == null || m.away_goals == null) continue;
    const home = goals.filter((g) => g.team === m.home_team).length;
    const away = goals.filter((g) => g.team === m.away_team).length;
    if (home !== m.home_goals || away !== m.away_goals) {
      report.errors.push(`match ${ref}: los goles suman ${home}-${away} y el marcador es ${m.home_goals}-${m.away_goals}`);
    }
  }
  for (const player of ds.aliases.keys()) need("players", player, "player_aliases");
  for (const s of ds.teamSuccessors) {
    need("teams", s.team, "team_successor");
    need("teams", s.successor, "team_successor");
    if (s.team === s.successor) report.errors.push(`team_successor: ${s.team} no puede sucederse a sí mismo`);
  }

  // Filas duplicadas según las mismas claves únicas que la base de datos.
  dupes(report, ds.competitionWinners, (w) => `${w.season}|${w.team}`, "competition_winner");
  dupes(report, ds.playerSpells, (s) => `${s.player}|${s.team}|${year(s.start_date)}|${s.is_loan}`, "player_spell");
  dupes(report, ds.transfers, (t) => `${t.player}|${t.to_team}|${year(t.transfer_date)}`, "transfer");
  dupes(report, ds.awardWinners, (w) => `${w.award}|${w.year_label}|${w.player}|${w.team}`, "award_winner");
  dupes(report, ds.records, (r) => r.title, "record");
  dupes(report, ds.matchGoals, (g) => `${g.match}|${g.minute}|${g.added_time ?? ""}|${g.player}`, "match_goal");
  dupes(report, ds.teamSuccessors, (s) => s.team, "team_successor");
  const seasonKeys = [...ds.seasons.values()];
  dupes(report, seasonKeys, (s) => `${s.competition}|${s.label}`, "season (competición + etiqueta)");

  return { dataset: ds, report };
}

function dupes<T>(report: Report, rows: T[], key: (r: T) => string, label: string) {
  const seen = new Set<string>();
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) report.errors.push(`${label} duplicado: ${k}`);
    seen.add(k);
  }
}

function withoutSource(x: unknown) {
  const { source: _ignored, ...rest } = x as Record<string, unknown>;
  return rest;
}

/** Año de una fecha parcial ("2004" o "2004-08-31"). */
export function year(d: string | null | undefined): number | null {
  return d ? Number(d.slice(0, 4)) : null;
}

/** Fecha completa o null si solo se conoce el año. */
export function fullDate(d: string | null | undefined): string | null {
  return d && d.length === 10 ? d : null;
}
