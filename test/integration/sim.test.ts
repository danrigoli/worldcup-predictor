import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_TEAM_IDS } from "@/lib/names";
import { blendRatings } from "@/lib/model/blend";
import { simulate } from "@/lib/engine";
import type { Match, Ratings } from "@/lib/types";

const ROOT = path.join(__dirname, "..", "..");

function load<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf-8"));
}

const fixtures = load<{ matches: Match[] }>("data/seeds/fixtures-2026.json");
const ratingsSeed = load<{ ratings: Ratings }>("data/derived/ratings.json");
const fifaSeed = load<{ points: Ratings }>("data/seeds/fifa-rankings.json");
const squadSeed = load<{ valuesEur: Partial<Ratings> }>(
  "data/seeds/squad-values.json"
);

const preRatings = blendRatings(
  ALL_TEAM_IDS,
  ratingsSeed.ratings,
  fifaSeed.points,
  squadSeed.valuesEur
);
const fifaRank = fifaSeed.points;

const SIMS = 2000;
const SEED = 12345;

describe("tournament simulation (integration)", () => {
  it("is deterministic for a fixed seed", () => {
    const a = simulate(fixtures.matches, preRatings, fifaRank, {}, SIMS, SEED);
    const b = simulate(fixtures.matches, preRatings, fifaRank, {}, SIMS, SEED);
    expect(a.odds).toEqual(b.odds);
  });

  it("title probabilities sum to ~1 across all teams", () => {
    const { odds } = simulate(fixtures.matches, preRatings, fifaRank, {}, SIMS, SEED);
    const total = ALL_TEAM_IDS.reduce((s, id) => s + odds[id].winner, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("reaching-round probabilities are monotone per team", () => {
    const { odds } = simulate(fixtures.matches, preRatings, fifaRank, {}, SIMS, SEED);
    for (const id of ALL_TEAM_IDS) {
      const o = odds[id];
      expect(o.r32).toBeGreaterThanOrEqual(o.r16 - 1e-9);
      expect(o.r16).toBeGreaterThanOrEqual(o.qf - 1e-9);
      expect(o.qf).toBeGreaterThanOrEqual(o.sf - 1e-9);
      expect(o.sf).toBeGreaterThanOrEqual(o.final - 1e-9);
      expect(o.final).toBeGreaterThanOrEqual(o.winner - 1e-9);
    }
  });

  it("expected qualifier counts are correct (32 to R32, 16 to R16, ...)", () => {
    const { odds } = simulate(fixtures.matches, preRatings, fifaRank, {}, SIMS, SEED);
    const sum = (k: "r32" | "r16" | "qf" | "sf" | "final") =>
      ALL_TEAM_IDS.reduce((s, id) => s + odds[id][k], 0);
    expect(sum("r32")).toBeCloseTo(32, 1);
    expect(sum("r16")).toBeCloseTo(16, 1);
    expect(sum("qf")).toBeCloseTo(8, 1);
    expect(sum("sf")).toBeCloseTo(4, 1);
    expect(sum("final")).toBeCloseTo(2, 1);
  });

  it("conditions on results: forcing an unplayed match shifts advancement the right way", () => {
    // Robust to tournament progress (groups OR knockouts): force the FIRST
    // unplayed match with two known teams. The only universally monotone effect
    // of a result is reaching the round that match FEEDS INTO — winning never
    // lowers it (deeper-round odds aren't monotone, since the bracket slot you
    // land in matters).
    const nextStage: Record<
      string,
      "r32" | "r16" | "qf" | "sf" | "final" | "winner" | null
    > = {
      group: "r32",
      r32: "r16",
      r16: "qf",
      qf: "sf",
      sf: "final",
      final: "winner",
      "third-place": null,
    };
    const target = fixtures.matches.find(
      (m) =>
        m.homeScore === null &&
        m.home.kind === "team" &&
        m.away.kind === "team" &&
        nextStage[m.stage] !== null
    );
    expect(target).toBeDefined();
    const home = (target!.home as { team: string }).team;
    const away = (target!.away as { team: string }).team;
    const mn = target!.matchNumber;
    const stage = nextStage[target!.stage]!;

    const homeWin = simulate(fixtures.matches, preRatings, fifaRank, { [mn]: { homeScore: 4, awayScore: 0 } }, SIMS, SEED);
    const awayWin = simulate(fixtures.matches, preRatings, fifaRank, { [mn]: { homeScore: 0, awayScore: 4 } }, SIMS, SEED);

    expect(homeWin.odds[home][stage]).toBeGreaterThanOrEqual(awayWin.odds[home][stage] - 1e-9);
    expect(awayWin.odds[away][stage]).toBeGreaterThanOrEqual(homeWin.odds[away][stage] - 1e-9);
    // The override must visibly move the forecast somewhere.
    const moved = ALL_TEAM_IDS.some(
      (id) => Math.abs(homeWin.odds[id].winner - awayWin.odds[id].winner) > 0.003
    );
    expect(moved).toBe(true);
  });

  it("favorite title odds land in a plausible band (~8-22%)", () => {
    const { odds } = simulate(fixtures.matches, preRatings, fifaRank, {}, SIMS, SEED);
    const sorted = ALL_TEAM_IDS.map((id) => ({ id, p: odds[id].winner })).sort(
      (x, y) => y.p - x.p
    );
    const top = sorted[0];
    // Opta ~16%, Zeileis ~14.5% for the favorite; allow a generous band.
    expect(top.p).toBeGreaterThan(0.06);
    expect(top.p).toBeLessThan(0.25);
  });
});
