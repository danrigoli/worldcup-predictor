import { unstable_cache } from "next/cache";
import { getMatchData, playedMatches, type MatchData } from "@/lib/data/fixtures";
import {
  blendedPreTournamentRatings,
  effectiveRatings,
} from "@/lib/data/ratings";
import { runSimulation } from "@/lib/sim/run";
import type { Match, Ratings, SimResult } from "@/lib/types";

import fifaSeed from "@/data/seeds/fifa-rankings.json";

export const fifaRankPoints = fifaSeed.points as Ratings;

/** Re-exported pure sim entry (used by the snapshot runner and tests). */
export const simulate = runSimulation;

/** Signature of all played results — used to key the server-side sim cache. */
function resultsSignature(matches: Match[]): string {
  return playedMatches(matches)
    .map((m) => `${m.matchNumber}:${m.homeScore}-${m.awayScore}`)
    .join(",");
}

export interface PredictionData {
  matchData: MatchData;
  preRatings: Ratings;
  effective: Ratings;
  fifaRank: Ratings;
  result: SimResult;
}

/**
 * Full prediction bundle for the server pages. The baseline sim is cached and
 * re-keyed whenever the set of played results changes.
 */
export async function getPrediction(): Promise<PredictionData> {
  const matchData = await getMatchData();
  const played = playedMatches(matchData.matches);
  const preRatings = blendedPreTournamentRatings();
  const effective = effectiveRatings(played);

  // Key the cache by the results signature so new scores invalidate it.
  const signature = resultsSignature(matchData.matches);
  const result = await unstable_cache(
    async () => simulate(matchData.matches, preRatings, fifaRankPoints),
    ["wc2026-sim", signature],
    { revalidate: 7200 }
  )();

  return { matchData, preRatings, effective, fifaRank: fifaRankPoints, result };
}
