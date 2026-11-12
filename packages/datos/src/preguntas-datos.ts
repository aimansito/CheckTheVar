// Carga en memoria los datos de fútbol necesarios para generar preguntas.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Country = { code: string; name_es: string; confederation: string | null };
export type Team = { id: number; slug: string; type: "club" | "national"; name: string; short_name: string | null; country_code: string | null; successor_team_id: number | null };
export type Competition = { id: number; slug: string; name: string; type: string };
export type Season = { id: number; slug: string; competition_id: number; label: string; host_country: string | null; source_url: string | null };
export type Player = {
  id: number; slug: string; full_name: string; known_as: string; birth_date: string | null; nationality: string | null;
  second_nationality: string | null; position: string | null; retired: boolean | null; source_url: string | null;
};
export type Spell = { player_id: number; team_id: number; start_year: number | null; end_year: number | null; is_loan: boolean };
export type Transfer = {
  id: number; player_id: number; from_team_id: number | null; to_team_id: number | null; transfer_year: number | null;
  fee_amount: string | null; fee_currency: string | null; fee_is_estimate: boolean; source_url: string | null;
};
export type Award = { id: number; slug: string; name: string; source_url: string | null };
export type AwardWinner = { award_id: number; year_label: string; player_id: number | null; team_id: number | null; rank: number; source_url: string | null };
export type Winner = { season_id: number; team_id: number; final_rank: number; source_url: string | null };
export type Match = {
  id: number; slug: string; season_id: number | null; stage: string | null; match_date: string | null; home_team_id: number; away_team_id: number;
  home_goals: number | null; away_goals: number | null; extra_time: boolean | null; penalties: string | null; venue: string | null; source_url: string | null;
};
export type Goal = { match_id: number; team_id: number; player_id: number; minute: number; added_time: number | null; penalty: boolean; own_goal: boolean; source_url: string | null };
export type Lineup = { match_id: number; player_id: number };
export type Record_ = { id: number; title: string; description: string | null; value_text: string | null; player_id: number | null; team_id: number | null; still_standing: boolean; source_url: string | null };

export type Data = {
  countries: Map<string, Country>;
  teams: Map<number, Team>;
  competitions: Map<number, Competition>;
  seasons: Map<number, Season>;
  players: Map<number, Player>;
  awards: Map<number, Award>;
  awardWinners: AwardWinner[];
  transfers: Transfer[];
  matches: Match[];
  records: Record_[];
  spellsByPlayer: Map<number, Spell[]>;
  winnersBySeason: Map<number, Winner[]>;
  goalsByMatch: Map<number, Goal[]>;
  lineupsByMatch: Map<number, Lineup[]>;
  aliasesByPlayer: Map<number, string[]>;
  /** Goles (sin propia puerta) marcados en finales. */
  finalGoalsByPlayer: Map<number, number>;
};

async function all<T>(db: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order(columns.split(",")[0]!.trim()).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

export async function loadData(db: SupabaseClient): Promise<Data> {
  const [countries, teams, competitions, seasons, players, awards, awardWinners, transfers, matches, records, spells, winners, goals, lineups, aliases] =
    await Promise.all([
      all<Country>(db, "countries", "code, name_es, confederation"),
      all<Team>(db, "teams", "id, slug, type, name, short_name, country_code, successor_team_id"),
      all<Competition>(db, "competitions", "id, slug, name, type"),
      all<Season>(db, "seasons", "id, slug, competition_id, label, host_country, source_url"),
      all<Player>(db, "players", "id, slug, full_name, known_as, birth_date, nationality, second_nationality, position, retired, source_url"),
      all<Award>(db, "awards", "id, slug, name, source_url"),
      all<AwardWinner>(db, "award_winners", "id, award_id, year_label, player_id, team_id, rank, source_url"),
      all<Transfer>(db, "transfers", "id, player_id, from_team_id, to_team_id, transfer_year, fee_amount, fee_currency, fee_is_estimate, source_url"),
      all<Match>(db, "matches", "id, slug, season_id, stage, match_date, home_team_id, away_team_id, home_goals, away_goals, extra_time, penalties, venue, source_url"),
      all<Record_>(db, "records", "id, title, description, value_text, player_id, team_id, still_standing, source_url"),
      all<Spell>(db, "player_spells", "id, player_id, team_id, start_year, end_year, is_loan"),
      all<Winner>(db, "competition_winners", "season_id, team_id, final_rank, source_url"),
      all<Goal>(db, "match_goals", "id, match_id, team_id, player_id, minute, added_time, penalty, own_goal, source_url"),
      all<Lineup>(db, "match_lineups", "match_id, player_id"),
      all<{ player_id: number; alias: string }>(db, "player_aliases", "player_id, alias"),
    ]);
  const byId = <T extends { id: number }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  return {
    countries: new Map(countries.map((c) => [c.code, c])),
    teams: byId(teams),
    competitions: byId(competitions),
    seasons: byId(seasons),
    players: byId(players),
    awards: byId(awards),
    awardWinners,
    transfers,
    matches,
    records,
    spellsByPlayer: Map.groupBy(spells, (s) => s.player_id),
    winnersBySeason: Map.groupBy(winners, (w) => w.season_id),
    goalsByMatch: Map.groupBy(goals, (g) => g.match_id),
    lineupsByMatch: Map.groupBy(lineups, (l) => l.match_id),
    aliasesByPlayer: new Map([...Map.groupBy(aliases, (a) => a.player_id)].map(([k, v]) => [k, v.map((a) => a.alias)])),
    finalGoalsByPlayer: new Map(
      [...Map.groupBy(goals.filter((g) => !g.own_goal), (g) => g.player_id)].map(([k, v]) => [k, v.length]),
    ),
  };
}
