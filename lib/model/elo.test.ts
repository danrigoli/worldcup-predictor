import { describe, expect, it } from "vitest";
import {
  eloDelta,
  expectedScore,
  gFactor,
  kFactorForTournament,
  runHistory,
} from "./elo";

describe("expectedScore", () => {
  it("is 0.5 at equal ratings", () => {
    expect(expectedScore(0)).toBeCloseTo(0.5, 12);
  });

  it("is ~0.64 at +100 and symmetric", () => {
    expect(expectedScore(100)).toBeCloseTo(0.6400649998, 6);
    expect(expectedScore(100) + expectedScore(-100)).toBeCloseTo(1, 12);
  });
});

describe("gFactor", () => {
  it("follows the World Football Elo schedule", () => {
    expect(gFactor(0)).toBe(1);
    expect(gFactor(1)).toBe(1);
    expect(gFactor(-1)).toBe(1);
    expect(gFactor(2)).toBe(1.5);
    expect(gFactor(3)).toBeCloseTo(14 / 8, 12);
    expect(gFactor(-5)).toBeCloseTo(16 / 8, 12);
  });
});

describe("kFactorForTournament", () => {
  it("maps martj42 labels to K", () => {
    expect(kFactorForTournament("FIFA World Cup")).toBe(60);
    expect(kFactorForTournament("FIFA World Cup qualification")).toBe(40);
    expect(kFactorForTournament("Copa América")).toBe(50);
    expect(kFactorForTournament("UEFA Euro")).toBe(50);
    expect(kFactorForTournament("UEFA Euro qualification")).toBe(40);
    expect(kFactorForTournament("African Cup of Nations")).toBe(50);
    expect(kFactorForTournament("AFC Asian Cup")).toBe(50);
    expect(kFactorForTournament("Gold Cup")).toBe(50);
    expect(kFactorForTournament("Confederations Cup")).toBe(50);
    expect(kFactorForTournament("Friendly")).toBe(20);
    expect(kFactorForTournament("UEFA Nations League")).toBe(30);
  });
});

describe("eloDelta", () => {
  it("computes the exact update for a crafted match", () => {
    // Equal ratings, neutral ground, 2-0 home win:
    // We = 0.5, W = 1, G = 1.5, K = 60 → delta = 60 * 1.5 * 0.5 = 45
    expect(eloDelta(1800, 1800, 2, 0, 60, 0)).toBeCloseTo(45, 10);
  });

  it("applies home advantage only when provided", () => {
    const neutral = eloDelta(1800, 1800, 1, 0, 60, 0);
    const home = eloDelta(1800, 1800, 1, 0, 60, 80);
    // With HA the home win was more expected → smaller gain.
    expect(home).toBeLessThan(neutral);
    expect(neutral).toBeCloseTo(30, 10);
  });

  it("is zero-sum by construction", () => {
    // Loser loses exactly what winner gains (single delta applied ±).
    const d = eloDelta(1900, 1700, 0, 1, 40, 0);
    expect(d).toBeLessThan(0);
  });
});

describe("runHistory", () => {
  it("produces hand-computed ratings over a tiny history", () => {
    const table = runHistory(
      [
        {
          date: "2020-01-01",
          home: "Alpha",
          away: "Beta",
          homeScore: 2,
          awayScore: 0,
          tournament: "Friendly",
          neutral: true,
        },
        {
          date: "2020-01-08",
          home: "Beta",
          away: "Alpha",
          homeScore: 1,
          awayScore: 1,
          tournament: "FIFA World Cup",
          neutral: true,
        },
      ],
      80
    );
    // Match 1: We=0.5, W=1, G=1.5, K=20 → Alpha 1515, Beta 1485.
    // Match 2: diff = 1485-1515 = -30 → We(Beta) = 1/(1+10^(30/400)) ≈ 0.456907
    // W=0.5, G=1, K=60 → delta = 60 * (0.5 - 0.456907) ≈ +2.5856 to Beta.
    const alpha = table.get("Alpha")!;
    const beta = table.get("Beta")!;
    expect(alpha.rating).toBeCloseTo(1515 - 2.5856, 2);
    expect(beta.rating).toBeCloseTo(1485 + 2.5856, 2);
    expect(alpha.matches).toBe(2);
    expect(beta.lastMatch).toBe("2020-01-08");
  });

  it("applies home advantage when not neutral", () => {
    const run = (neutral: boolean) =>
      runHistory(
        [
          {
            date: "2020-01-01",
            home: "Alpha",
            away: "Beta",
            homeScore: 1,
            awayScore: 0,
            tournament: "Friendly",
            neutral,
          },
        ],
        80
      ).get("Alpha")!.rating;
    expect(run(false)).toBeLessThan(run(true));
  });
});
