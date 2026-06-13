import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/rng";
import { GRID_SIZE, oneXTwo, scoreGrid } from "./dixon-coles";
import { ScoreSampler } from "./score-sampler";

describe("ScoreSampler", () => {
  it("sampled distribution matches the exact grid", () => {
    const sampler = new ScoreSampler();
    const rng = mulberry32(99);
    const lambda = 1.62;
    const mu = 0.97;
    const n = 200_000;
    let homeWins = 0;
    let draws = 0;
    for (let i = 0; i < n; i++) {
      const { home, away } = sampler.sample(lambda, mu, rng);
      if (home > away) homeWins++;
      else if (home === away) draws++;
    }
    const exact = oneXTwo(scoreGrid(lambda, mu));
    expect(homeWins / n).toBeCloseTo(exact.home, 2);
    expect(draws / n).toBeCloseTo(exact.draw, 2);
  });

  it("is deterministic for a fixed seed", () => {
    const draw = () => {
      const sampler = new ScoreSampler();
      const rng = mulberry32(7);
      return Array.from({ length: 20 }, () => sampler.sample(2.1, 0.8, rng));
    };
    expect(draw()).toEqual(draw());
  });

  it("stays within the goal grid", () => {
    const sampler = new ScoreSampler();
    const rng = mulberry32(5);
    for (let i = 0; i < 10_000; i++) {
      const { home, away } = sampler.sample(3.5, 3.5, rng);
      expect(home).toBeGreaterThanOrEqual(0);
      expect(home).toBeLessThan(GRID_SIZE);
      expect(away).toBeGreaterThanOrEqual(0);
      expect(away).toBeLessThan(GRID_SIZE);
    }
  });
});
