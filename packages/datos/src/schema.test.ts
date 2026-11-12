import { describe, expect, it } from "vitest";
import { buildDataset, fullDate, year } from "./schema.ts";

const src = "https://es.wikipedia.org/wiki/Ejemplo";
const base = {
  countries: [{ code: "ES", name_es: "España", name_en: "Spain", confederation: "UEFA" }],
  teams: [{ ref: "fc-barcelona", type: "club", name: "FC Barcelona", country: "ES", source: src }],
  players: [{ ref: "lionel-messi", full_name: "Lionel Messi", known_as: "Messi", nationality: "AR", source: src }],
};

describe("buildDataset", () => {
  it("detecta refs no definidos", () => {
    const { report } = buildDataset([{ name: "a.json", data: base }]);
    expect(report.errors).toEqual(['player lionel-messi: countries "AR" no está definido']);
  });

  it("une lotes en orden: un lote posterior puede usar refs de uno anterior", () => {
    const { dataset, report } = buildDataset([
      { name: "1.json", data: { ...base, countries: [...base.countries, { code: "AR", name_es: "Argentina", name_en: "Argentina" }] } },
      { name: "2.json", data: { player_spells: [{ player: "lionel-messi", team: "fc-barcelona", start_date: "2004", end_date: "2021", source: src }] } },
    ]);
    expect(report.errors).toEqual([]);
    expect(dataset.playerSpells).toHaveLength(1);
  });

  it("exige source con URL", () => {
    const { report } = buildDataset([{ name: "a.json", data: { teams: [{ ref: "x", type: "club", name: "X" }] } }]);
    expect(report.errors.join()).toMatch(/teams\.0\.source/);
  });

  it("rechaza valores fuera del enum y fechas mal escritas", () => {
    const { report } = buildDataset([{ name: "a.json", data: {
      teams: [{ ref: "x", type: "equipo", name: "X", source: src }],
      players: [{ ref: "p", full_name: "P", known_as: "P", birth_date: "24/06/1987", source: src }],
    } }]);
    expect(report.errors.some((e) => e.includes("teams.0.type"))).toBe(true);
    expect(report.errors.some((e) => e.includes("players.0.birth_date"))).toBe(true);
  });

  it("acepta códigos de subdivisión como GB-ENG", () => {
    const { report } = buildDataset([{ name: "a.json", data: { countries: [{ code: "GB-ENG", name_es: "Inglaterra", name_en: "England" }] } }]);
    expect(report.errors).toEqual([]);
  });

  it("ref repetido: idéntico es aviso, distinto es error", () => {
    const same = buildDataset([{ name: "1.json", data: base }, { name: "2.json", data: { teams: base.teams } }]);
    expect(same.report.warnings.some((w) => w.includes("idéntico"))).toBe(true);
    const diff = buildDataset([{ name: "1.json", data: base }, { name: "2.json", data: { teams: [{ ...base.teams[0], founded_year: 1900 }] } }]);
    expect(diff.report.errors.some((e) => e.includes("datos distintos"))).toBe(true);
  });

  it("una cesión y el traspaso definitivo al mismo club el mismo año no son duplicados", () => {
    const spell = { player: "lionel-messi", team: "fc-barcelona", start_date: "2000", source: src };
    const data = { ...base, countries: [...base.countries, { code: "AR", name_es: "Argentina", name_en: "Argentina" }] };
    const ok = buildDataset([{ name: "a.json", data: { ...data, player_spells: [{ ...spell, is_loan: true }, { ...spell, is_loan: false }] } }]);
    expect(ok.report.errors).toEqual([]);
    const dup = buildDataset([{ name: "a.json", data: { ...data, player_spells: [spell, spell] } }]);
    expect(dup.report.errors.some((e) => e.includes("player_spell duplicado"))).toBe(true);
  });
});

describe("goles, alias y herencia", () => {
  const sel = (ref: string) => ({ ref, type: "national", name: ref, country: "ES", source: src });
  const data = {
    countries: base.countries,
    teams: [sel("a"), sel("b"), sel("c")],
    players: [
      { ref: "p1", full_name: "P1", known_as: "P1", nationality: "ES", aliases: ["Uno"], source: src },
      { ref: "p2", full_name: "P2", known_as: "P2", nationality: "ES", source: src },
    ],
    matches: [{ ref: "m", home_team: "a", away_team: "b", home_goals: 1, away_goals: 0, source: src }],
  };
  const goal = { match: "m", minute: 10, player: "p1", team: "a", assist: "p2", source: src };

  it("acepta goles que cuadran con el marcador y une los alias de ficha y de sección", () => {
    const { dataset, report } = buildDataset([{ name: "a.json", data: { ...data, match_goals: [goal], player_aliases: [{ player: "p1", aliases: ["Dos"] }] } }]);
    expect(report.errors).toEqual([]);
    expect([...dataset.aliases.get("p1")!]).toEqual(["Uno", "Dos"]);
  });

  it("detecta goles que no cuadran, equipos que no jugaron y asistente = goleador", () => {
    const bad = buildDataset([{ name: "a.json", data: { ...data, match_goals: [goal, { ...goal, minute: 20 }] } }]);
    expect(bad.report.errors.some((e) => e.includes("los goles suman 2-0"))).toBe(true);
    const wrongTeam = buildDataset([{ name: "a.json", data: { ...data, match_goals: [{ ...goal, team: "c" }] } }]);
    expect(wrongTeam.report.errors.some((e) => e.includes("no jugó ese partido"))).toBe(true);
    const self = buildDataset([{ name: "a.json", data: { ...data, match_goals: [{ ...goal, assist: "p1" }] } }]);
    expect(self.report.errors.some((e) => e.includes("el asistente no puede ser el goleador"))).toBe(true);
  });

  it("valida la herencia de selecciones", () => {
    const ok = buildDataset([{ name: "a.json", data: { ...data, team_successors: [{ team: "a", successor: "b", source: src }] } }]);
    expect(ok.report.errors).toEqual([]);
    const self = buildDataset([{ name: "a.json", data: { ...data, team_successors: [{ team: "a", successor: "a", source: src }] } }]);
    expect(self.report.errors.some((e) => e.includes("sí mismo"))).toBe(true);
  });
});

describe("fechas parciales", () => {
  it("separa el año y la fecha completa", () => {
    expect(year("2004")).toBe(2004);
    expect(fullDate("2004")).toBeNull();
    expect(year("2017-08-03")).toBe(2017);
    expect(fullDate("2017-08-03")).toBe("2017-08-03");
    expect(year(null)).toBeNull();
  });
});
