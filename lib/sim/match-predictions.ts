import { oneXTwo, scoreGrid, topScorelines } from "@/lib/model/dixon-coles";
import { defaultMatchModel } from "@/lib/sim/match-model";
import type { Match, MatchProbabilities, Ratings, TeamId } from "@/lib/types";

/**
 * Exact W/D/L + most-likely scorelines for a single match between two known
 * teams, using the Dixon-Coles grid (no sampling). Uses the same ML λ-matrix
 * the tournament sim uses. Called on the matches page.
 */
export function predictMatch(
  ratings: Ratings,
  home: TeamId,
  away: TeamId,
  hostCountry: Match["hostCountry"],
  topN = 5
): MatchProbabilities {
  const { lambdaHome, lambdaAway } = defaultMatchModel(ratings).lambdas(
    home,
    away,
    hostCountry
  );
  const grid = scoreGrid(lambdaHome, lambdaAway);
  const { home: h, draw, away: a } = oneXTwo(grid);
  return {
    home: h,
    draw,
    away: a,
    topScorelines: topScorelines(grid, topN),
  };
}
