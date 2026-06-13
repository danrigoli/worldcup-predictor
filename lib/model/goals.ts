import {
  BASE_LAMBDA,
  LAMBDA_MAX,
  LAMBDA_MIN,
  LAMBDA_PER_ELO,
} from "@/lib/constants";

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Expected goals for each side from blended Elo ratings.
 * `homeAdvantage` is the Elo bonus for the home side (0 on neutral ground).
 */
export function lambdasFor(
  ratingHome: number,
  ratingAway: number,
  homeAdvantage: number
): { lambdaHome: number; lambdaAway: number } {
  const diff = ratingHome + homeAdvantage - ratingAway;
  return {
    lambdaHome: clamp(BASE_LAMBDA + diff / LAMBDA_PER_ELO, LAMBDA_MIN, LAMBDA_MAX),
    lambdaAway: clamp(BASE_LAMBDA - diff / LAMBDA_PER_ELO, LAMBDA_MIN, LAMBDA_MAX),
  };
}
