import type { RNG } from "@/lib/rng";
import { GRID_SIZE, scoreGrid } from "@/lib/model/dixon-coles";

/**
 * Memoized scoreline sampler. Lambdas are quantized to 0.01 AFTER clamping
 * (clamped range 0.30–3.50 → integer 30–350), so the cumulative Dixon-Coles
 * grid for each (λh, λa) pair is computed once and sampling is a single
 * uniform draw + binary search. Across a 10k-sim tournament run the hit rate
 * is high enough to keep the whole simulation comfortably under a second.
 */
export class ScoreSampler {
  private cache = new Map<number, Float64Array>();

  private cumulativeGrid(lambdaHome: number, lambdaAway: number): Float64Array {
    const qh = Math.round(lambdaHome * 100);
    const qa = Math.round(lambdaAway * 100);
    const key = qh * 1000 + qa;
    let cdf = this.cache.get(key);
    if (!cdf) {
      const grid = scoreGrid(qh / 100, qa / 100);
      cdf = new Float64Array(grid.length);
      let acc = 0;
      for (let i = 0; i < grid.length; i++) {
        acc += grid[i];
        cdf[i] = acc;
      }
      this.cache.set(key, cdf);
    }
    return cdf;
  }

  sample(
    lambdaHome: number,
    lambdaAway: number,
    rng: RNG
  ): { home: number; away: number } {
    const cdf = this.cumulativeGrid(lambdaHome, lambdaAway);
    const u = rng();
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return { home: Math.floor(lo / GRID_SIZE), away: lo % GRID_SIZE };
  }
}
