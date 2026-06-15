import {
  LAMBDA_MAX,
  LAMBDA_MIN,
  LINEUP_OPP_TRANSFER,
} from "@/lib/constants";
import {
  oneXTwo,
  scoreGrid,
  topScorelineByOutcome,
  topScorelines,
} from "@/lib/model/dixon-coles";
import { defaultMatchModel } from "@/lib/sim/match-model";
import type { Match, MatchProbabilities, Ratings, TeamId } from "@/lib/types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Exact W/D/L + most-likely scorelines for a single match between two known
 * teams, using the Dixon-Coles grid (no sampling). Uses the same ML λ-matrix
 * the tournament sim uses.
 *
 * `penalty` (0–1 per side, from the confirmed lineup) weakens a side fielding
 * less than its strongest XI: its expected goals drop by its penalty, and the
 * opponent's rise by `penalty * OPP_TRANSFER` (they concede more).
 */
export function predictMatch(
  ratings: Ratings,
  home: TeamId,
  away: TeamId,
  hostCountry: Match["hostCountry"],
  topN = 5,
  penalty?: { home: number; away: number }
): MatchProbabilities {
  let { lambdaHome, lambdaAway } = defaultMatchModel(ratings).lambdas(
    home,
    away,
    hostCountry
  );
  if (penalty && (penalty.home > 0 || penalty.away > 0)) {
    const ph = penalty.home;
    const pa = penalty.away;
    lambdaHome = clamp(lambdaHome * (1 - ph) * (1 + LINEUP_OPP_TRANSFER * pa), LAMBDA_MIN, LAMBDA_MAX);
    lambdaAway = clamp(lambdaAway * (1 - pa) * (1 + LINEUP_OPP_TRANSFER * ph), LAMBDA_MIN, LAMBDA_MAX);
  }
  const grid = scoreGrid(lambdaHome, lambdaAway);
  const { home: h, draw, away: a } = oneXTwo(grid);
  return {
    home: h,
    draw,
    away: a,
    topScorelines: topScorelines(grid, topN),
    byOutcome: topScorelineByOutcome(grid),
  };
}
