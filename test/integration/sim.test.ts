import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_TEAM_IDS } from "@/lib/names";
import { blendRatings } from "@/lib/model/blend";
import { simulate } from "@/lib/engine";
import type { Match, Overrides, Ratings } from "@/lib/types";

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

  it("conditions on real results: locking Mexico 2-0 raises Mexico's advance odds", () => {
    // Strip Mexico's match-1 result, then compare with it present.
    const withoutResult = fixtures.matches.map((m) =>
      m.matchNumber === 1
        ? { ...m, homeScore: null, awayScore: null, winner: null }
        : m
    );
    const a = simulate(withoutResult, preRatings, fifaRank, {}, SIMS, SEED);

    const overrideWin: Overrides = { 1: { homeScore: 2, awayScore: 0 } };
    const b = simulate(withoutResult, preRatings, fifaRank, overrideWin, SIMS, SEED);

    // Mexico (MEX) reaching the R32 should be at least as likely with a 2-0 win.
    expect(b.odds.MEX.r32).toBeGreaterThan(a.odds.MEX.r32);
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
