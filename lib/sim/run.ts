import { SEED, SIM_COUNT } from "@/lib/constants";
import { buildSimContext } from "@/lib/sim/bracket";
import { runSims } from "@/lib/sim/monte-carlo";
import type { Match, Overrides, Ratings, SimResult } from "@/lib/types";

/**
 * Pure simulation entry shared by the server and the what-if Web Worker.
 * Dependency-free of next/* and the data layer, so it bundles cleanly into a
 * Worker. `preRatings` are PRE-tournament blended strengths; the sim replays
 * locked (played + overridden) matches with forward Elo, so played results
 * must not be pre-applied to the ratings passed here.
 */
export function runSimulation(
  matches: Match[],
  preRatings: Ratings,
  fifaRank: Ratings,
  overrides: Overrides = {},
  simCount: number = SIM_COUNT,
  seed: number = SEED
): SimResult {
  const ctx = buildSimContext(matches, preRatings, fifaRank, overrides);
  return runSims(ctx, simCount, seed);
}
