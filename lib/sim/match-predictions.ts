import { lambdasFor } from "@/lib/model/goals";
import { oneXTwo, scoreGrid, topScorelines } from "@/lib/model/dixon-coles";
import { netHomeAdvantage } from "@/lib/data/venues";
import type { Match, MatchProbabilities, Ratings, TeamId } from "@/lib/types";

/**
 * Exact W/D/L + most-likely scorelines for a single match between two known
 * teams, using the Dixon-Coles grid (no sampling). Used on the matches page.
 */
export function predictMatch(
  ratings: Ratings,
  home: TeamId,
  away: TeamId,
  hostCountry: Match["hostCountry"],
  topN = 5
): MatchProbabilities {
  const ha = netHomeAdvantage({ hostCountry }, home, away);
  const { lambdaHome, lambdaAway } = lambdasFor(ratings[home], ratings[away], ha);
  const grid = scoreGrid(lambdaHome, lambdaAway);
  const { home: h, draw, away: a } = oneXTwo(grid);
  return {
    home: h,
    draw,
    away: a,
    topScorelines: topScorelines(grid, topN),
  };
}
