// Importa los lotes JSON de docs/datos a Supabase. Es idempotente: reimportar actualiza, no duplica.
//
// Uso (desde la raíz):
//   pnpm datos:validar [lote1.json lote2.json …]   solo valida, no escribe nada
//   pnpm datos:importar [lote1.json lote2.json …]  valida y, si no hay errores, importa
// Sin archivos, usa docs/datos/lote*.json en orden alfabético.
// Credenciales: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY del entorno o de apps/web/.env.local.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildDataset, fullDate, year, type Dataset } from "./schema.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DATA_DIR = resolve(ROOT, "docs/datos");

const args = process.argv.slice(2);
const onlyValidate = args.includes("--validar");
const files = args.filter((a) => !a.startsWith("--"));
const paths = (files.length ? files : readdirSync(DATA_DIR).filter((f) => /^lote.*\.json$/.test(f)).sort()).map((f) =>
  existsSync(f) ? resolve(f) : resolve(DATA_DIR, f),
);

console.log("Lotes:", paths.map((p) => basename(p)).join(", "));
const { dataset, report } = buildDataset(
  paths.map((p) => ({ name: basename(p), data: JSON.parse(readFileSync(p, "utf8")) as unknown })),
);
for (const w of report.warnings) console.log("  aviso:", w);
for (const e of report.errors) console.log("  ERROR:", e);
console.log(
  `Datos: ${dataset.countries.size} países, ${dataset.teams.size} equipos, ${dataset.competitions.size} competiciones, ` +
    `${dataset.seasons.size} ediciones, ${dataset.players.size} jugadores, ${dataset.playerSpells.length} etapas, ` +
    `${dataset.competitionWinners.length} campeones/subcampeones, ${dataset.awardWinners.length} premiados, ` +
    `${dataset.transfers.length} fichajes, ${dataset.matches.size} partidos, ${dataset.matchGoals.length} goles, ` +
    `${dataset.records.length} récords, ${[...dataset.aliases.values()].reduce((n, s) => n + s.size, 0)} alias`,
);
if (report.errors.length) {
  console.log(`\n${report.errors.length} errores: no se importa nada.`);
  process.exit(1);
}
if (onlyValidate) {
  console.log("\nValidación correcta.");
  process.exit(0);
}

const envFile = resolve(ROOT, "apps/web/.env.local");
if (!process.env.SUPABASE_SECRET_KEY && existsSync(envFile)) process.loadEnvFile(envFile);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (entorno o apps/web/.env.local).");
  process.exit(1);
}
console.log(`\nImportando en ${new URL(url).host}…`);
await importDataset(createClient(url, key, { auth: { persistSession: false } }), dataset);
console.log("Importación terminada.");

async function importDataset(db: SupabaseClient, ds: Dataset) {
  const values = <T>(m: Map<string, T>) => [...m.values()];

  await upsert(db, "countries", values(ds.countries).map((c) => ({
    code: c.code, name_es: c.name_es, name_en: c.name_en, confederation: c.confederation ?? null,
  })), "code");

  const teams = await upsertBySlug(db, "teams", values(ds.teams).map((t) => ({
    slug: t.ref, type: t.type, name: t.name, short_name: t.short_name ?? null,
    country_code: t.country ?? null, founded_year: t.founded_year ?? null, source_url: t.source,
  })));

  const competitions = await upsertBySlug(db, "competitions", values(ds.competitions).map((c) => ({
    slug: c.ref, name: c.name, type: c.type, country_code: c.country ?? null, tier: c.tier ?? null, source_url: c.source,
  })));

  const seasons = await upsertBySlug(db, "seasons", values(ds.seasons).map((s) => ({
    slug: s.ref, competition_id: id(competitions, s.competition), label: s.label,
    start_date: fullDate(s.start_date), end_date: fullDate(s.end_date),
    host_country: s.host_country ?? null, source_url: s.source,
  })));

  const players = await upsertBySlug(db, "players", values(ds.players).map((p) => ({
    slug: p.ref, full_name: p.full_name, known_as: p.known_as,
    birth_date: fullDate(p.birth_date), death_date: fullDate(p.death_date),
    nationality: p.nationality ?? null, second_nationality: p.second_nationality ?? null,
    position: p.position ?? null, height_cm: p.height_cm ?? null, foot: p.foot ?? null,
    retired: p.retired ?? null, popularity: p.popularity ?? 0, source_url: p.source,
  })));

  await upsert(db, "player_aliases", [...ds.aliases].flatMap(([ref, aliases]) =>
    [...aliases].map((alias) => ({ player_id: id(players, ref), alias })),
  ), "player_id,alias");

  // Herencia de selecciones (RFA → Alemania…). Se aplica tras crear los equipos.
  for (const s of ds.teamSuccessors) {
    const { error } = await db.from("teams").update({ successor_team_id: id(teams, s.successor) }).eq("id", id(teams, s.team));
    if (error) throw new Error(`teams (successor): ${error.message}`);
  }
  if (ds.teamSuccessors.length) console.log(`  teams.successor_team_id: ${ds.teamSuccessors.length}`);

  const awards = await upsertBySlug(db, "awards", values(ds.awards).map((a) => ({
    slug: a.ref, name: a.name, scope: a.scope, organizer: a.organizer ?? null,
    competition_id: a.competition ? id(competitions, a.competition) : null, source_url: a.source,
  })));

  const matches = await upsertBySlug(db, "matches", values(ds.matches).map((m) => ({
    slug: m.ref, season_id: m.season ? id(seasons, m.season) : null, stage: m.stage ?? null,
    match_date: fullDate(m.match_date), home_team_id: id(teams, m.home_team), away_team_id: id(teams, m.away_team),
    home_goals: m.home_goals ?? null, away_goals: m.away_goals ?? null, extra_time: m.extra_time,
    penalties: m.penalties ?? null, venue: m.venue ?? null, source_url: m.source,
  })));

  await upsert(db, "match_goals", ds.matchGoals.map((g) => ({
    match_id: id(matches, g.match), team_id: id(teams, g.team), player_id: id(players, g.player),
    assist_player_id: g.assist ? id(players, g.assist) : null, minute: g.minute, added_time: g.added_time ?? null,
    penalty: g.penalty, own_goal: g.own_goal, golden_goal: g.golden_goal, source_url: g.source,
  })), "match_id,minute,added_time,player_id");

  await upsert(db, "competition_winners", ds.competitionWinners.map((w) => ({
    season_id: id(seasons, w.season), team_id: id(teams, w.team), final_rank: w.final_rank, source_url: w.source,
  })), "season_id,team_id");

  await upsert(db, "player_spells", ds.playerSpells.map((s) => ({
    player_id: id(players, s.player), team_id: id(teams, s.team),
    start_year: year(s.start_date), end_year: year(s.end_date),
    start_date: fullDate(s.start_date), end_date: fullDate(s.end_date), is_loan: s.is_loan,
    appearances: s.appearances ?? null, goals: s.goals ?? null, assists: s.assists ?? null, source_url: s.source,
  })), "player_id,team_id,start_year,is_loan");

  await upsert(db, "transfers", ds.transfers.map((t) => ({
    player_id: id(players, t.player),
    from_team_id: t.from_team ? id(teams, t.from_team) : null, to_team_id: t.to_team ? id(teams, t.to_team) : null,
    transfer_year: year(t.transfer_date), transfer_date: fullDate(t.transfer_date), type: t.type,
    fee_amount: t.fee_amount ?? null, fee_currency: t.fee_currency, fee_is_estimate: t.fee_is_estimate, source_url: t.source,
  })), "player_id,to_team_id,transfer_year");

  await upsert(db, "award_winners", ds.awardWinners.map((w) => ({
    award_id: id(awards, w.award), year_label: w.year_label,
    player_id: w.player ? id(players, w.player) : null, team_id: w.team ? id(teams, w.team) : null,
    rank: w.rank, source_url: w.source,
  })), "award_id,year_label,player_id,team_id");

  await upsert(db, "records", ds.records.map((r) => ({
    title: r.title, description: r.description ?? null, value_numeric: r.value_numeric ?? null,
    value_text: r.value_text ?? null, player_id: r.player ? id(players, r.player) : null,
    team_id: r.team ? id(teams, r.team) : null, competition_id: r.competition ? id(competitions, r.competition) : null,
    achieved_on: fullDate(r.achieved_on), still_standing: r.still_standing, source_url: r.source,
  })), "title");

  const { error } = await db.from("data_sources").update({ last_sync_at: new Date().toISOString() })
    .eq("name", "Lotes JSON (Wikipedia y webs oficiales)");
  if (error) throw new Error(`data_sources: ${error.message}`);
}

function id(map: Map<string, number>, slug: string): number {
  const v = map.get(slug);
  if (v === undefined) throw new Error(`Sin id para "${slug}"`);
  return v;
}

async function upsert(db: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}${error.details ? ` (${error.details})` : ""}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

/** Upsert por slug y devuelve el mapa slug → id de toda la tabla. */
async function upsertBySlug(db: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  await upsert(db, table, rows, "slug");
  const ids = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("id, slug").not("slug", "is", null).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const r of data as { id: number; slug: string }[]) ids.set(r.slug, r.id);
    if (data.length < 1000) break;
  }
  return ids;
}
