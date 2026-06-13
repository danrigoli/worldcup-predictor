import { SEED, SIM_COUNT } from "@/lib/constants";
import { buildSimContext } from "@/lib/sim/bracket";
import { defaultMatchModel, type MatchModel } from "@/lib/sim/match-model";
import { runSims } from "@/lib/sim/monte-carlo";
import type { Match, Overrides, Ratings, SimResult } from "@/lib/types";

/**
 * Pure simulation entry shared by the server and the what-if Web Worker.
 * Dependency-free of next/* and the IO data layer, so it bundles cleanly into a
 * Worker.
 *
 * The strength model is the ML λ-matrix when its artifact is present, otherwise
 * the Elo→λ formula seeded from `ratings`. Pass an explicit `matchModel` to
 * override (used by scripts/calibrate-matrix.ts to test temperatures).
 */
export function runSimulation(
  matches: Match[],
  ratings: Ratings,
  fifaRank: Ratings,
  overrides: Overrides = {},
  simCount: number = SIM_COUNT,
  seed: number = SEED,
  matchModel?: MatchModel
): SimResult {
  const model = matchModel ?? defaultMatchModel(ratings);
  const ctx = buildSimContext(matches, model, fifaRank, overrides);
  return runSims(ctx, simCount, seed);
}
