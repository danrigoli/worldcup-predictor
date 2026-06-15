import { MAX_GOALS, RHO } from "@/lib/constants";
import type { MatchProbabilities } from "@/lib/types";

export const GRID_SIZE = MAX_GOALS + 1;

/** Dixon-Coles low-score correction factor. */
export function tau(
  x: number,
  y: number,
  lambda: number,
  mu: number,
  rho: number
): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/**
 * Joint scoreline probabilities over a (MAX_GOALS+1)² grid, flattened
 * row-major as grid[home * GRID_SIZE + away], renormalized to sum to 1.
 */
export function scoreGrid(
  lambda: number,
  mu: number,
  rho: number = RHO
): Float64Array {
  const ph = poissonRow(lambda);
  const pa = poissonRow(mu);
  const grid = new Float64Array(GRID_SIZE * GRID_SIZE);
  let total = 0;
  for (let h = 0; h < GRID_SIZE; h++) {
    for (let a = 0; a < GRID_SIZE; a++) {
      const p = ph[h] * pa[a] * tau(h, a, lambda, mu, rho);
      grid[h * GRID_SIZE + a] = p;
      total += p;
    }
  }
  for (let i = 0; i < grid.length; i++) grid[i] /= total;
  return grid;
}

function poissonRow(lambda: number): Float64Array {
  const row = new Float64Array(GRID_SIZE);
  row[0] = Math.exp(-lambda);
  for (let k = 1; k < GRID_SIZE; k++) row[k] = (row[k - 1] * lambda) / k;
  return row;
}

export function oneXTwo(grid: Float64Array): {
  home: number;
  draw: number;
  away: number;
} {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h < GRID_SIZE; h++) {
    for (let a = 0; a < GRID_SIZE; a++) {
      const p = grid[h * GRID_SIZE + a];
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  return { home, draw, away };
}

export function topScorelines(
  grid: Float64Array,
  n: number
): MatchProbabilities["topScorelines"] {
  const all: Array<{ home: number; away: number; p: number }> = [];
  for (let h = 0; h < GRID_SIZE; h++) {
    for (let a = 0; a < GRID_SIZE; a++) {
      all.push({ home: h, away: a, p: grid[h * GRID_SIZE + a] });
    }
  }
  all.sort((x, y) => y.p - x.p);
  return all.slice(0, n);
}

/**
 * Most likely exact scoreline within each outcome (home win / draw / away win).
 * Far more informative than the overall top-N, which clusters around 1-1/1-0
 * because individual scoreline probabilities are flat in low-scoring football.
 */
export function topScorelineByOutcome(
  grid: Float64Array
): MatchProbabilities["byOutcome"] {
  const best = {
    home: { home: 1, away: 0, p: -1 },
    draw: { home: 1, away: 1, p: -1 },
    away: { home: 0, away: 1, p: -1 },
  };
  for (let h = 0; h < GRID_SIZE; h++) {
    for (let a = 0; a < GRID_SIZE; a++) {
      const p = grid[h * GRID_SIZE + a];
      const key = h > a ? "home" : h === a ? "draw" : "away";
      if (p > best[key].p) best[key] = { home: h, away: a, p };
    }
  }
  return best;
}
