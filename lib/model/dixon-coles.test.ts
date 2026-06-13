import { describe, expect, it } from "vitest";
import { GRID_SIZE, oneXTwo, scoreGrid, topScorelines, tau } from "./dixon-coles";

describe("scoreGrid", () => {
  it("sums to 1", () => {
    const grid = scoreGrid(1.5, 1.1);
    const total = grid.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 9);
  });

  it("equals independent Poisson when rho = 0", () => {
    const lambda = 1.4;
    const mu = 0.9;
    const grid = scoreGrid(lambda, mu, 0);
    const pois = (l: number, k: number) => {
      let p = Math.exp(-l);
      for (let i = 1; i <= k; i++) p = (p * l) / i;
      return p;
    };
    // Normalization over the truncated grid:
    let total = 0;
    for (let h = 0; h < GRID_SIZE; h++)
      for (let a = 0; a < GRID_SIZE; a++) total += pois(lambda, h) * pois(mu, a);
    expect(grid[0]).toBeCloseTo((pois(lambda, 0) * pois(mu, 0)) / total, 12);
    expect(grid[2 * GRID_SIZE + 1]).toBeCloseTo(
      (pois(lambda, 2) * pois(mu, 1)) / total,
      12
    );
  });

  it("negative rho inflates 0-0/1-1 and deflates 0-1/1-0", () => {
    const indep = scoreGrid(1.2, 1.2, 0);
    const dc = scoreGrid(1.2, 1.2, -0.13);
    expect(dc[0]).toBeGreaterThan(indep[0]); // 0-0: tau = 1 - λμρ > 1
    expect(dc[1 * GRID_SIZE + 1]).toBeGreaterThan(indep[1 * GRID_SIZE + 1]); // 1-1: tau = 1 - ρ > 1
    expect(dc[0 * GRID_SIZE + 1]).toBeLessThan(indep[0 * GRID_SIZE + 1]); // 0-1: tau = 1 + λρ < 1
    expect(dc[1 * GRID_SIZE + 0]).toBeLessThan(indep[1 * GRID_SIZE + 0]); // 1-0: tau = 1 + μρ < 1
  });
});

describe("tau", () => {
  it("matches the Dixon-Coles definition", () => {
    const l = 1.2;
    const m = 0.8;
    const r = -0.13;
    expect(tau(0, 0, l, m, r)).toBeCloseTo(1 - l * m * r, 12);
    expect(tau(0, 1, l, m, r)).toBeCloseTo(1 + l * r, 12);
    expect(tau(1, 0, l, m, r)).toBeCloseTo(1 + m * r, 12);
    expect(tau(1, 1, l, m, r)).toBeCloseTo(1 - r, 12);
    expect(tau(2, 1, l, m, r)).toBe(1);
  });
});

describe("oneXTwo", () => {
  it("partitions the grid", () => {
    const grid = scoreGrid(1.6, 1.0);
    const { home, draw, away } = oneXTwo(grid);
    expect(home + draw + away).toBeCloseTo(1, 9);
    expect(home).toBeGreaterThan(away);
  });

  it("home win prob increases monotonically with Elo diff", () => {
    // lambdas derived from increasing rating gaps
    let prev = 0;
    for (const diff of [-200, -100, 0, 100, 200, 400]) {
      const lh = Math.min(3.5, Math.max(0.3, 1.35 + diff / 400));
      const la = Math.min(3.5, Math.max(0.3, 1.35 - diff / 400));
      const { home } = oneXTwo(scoreGrid(lh, la));
      expect(home).toBeGreaterThan(prev);
      prev = home;
    }
  });
});

describe("topScorelines", () => {
  it("returns n entries sorted by probability", () => {
    const top = topScorelines(scoreGrid(1.35, 1.35), 5);
    expect(top).toHaveLength(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i].p).toBeLessThanOrEqual(top[i - 1].p);
    }
  });
});
