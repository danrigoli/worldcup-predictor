import { lambdasFor } from "@/lib/model/goals";
import {
  COMMITTED_MATRIX,
  hasMatrix,
  matrixLambdas,
  type LambdaMatrix,
} from "@/lib/model/lambda-matrix";
import { netHomeAdvantage } from "@/lib/data/venues";
import type { HostCountry, Ratings, TeamId } from "@/lib/types";

/**
 * Strength model the tournament sim queries for each match. Pure and
 * worker-safe. Two implementations: the ML λ-matrix (primary) and the Elo→λ
 * formula (fallback when no artifact is present).
 */
export interface MatchModel {
  lambdas(
    home: TeamId,
    away: TeamId,
    hostCountry: HostCountry | null
  ): { lambdaHome: number; lambdaAway: number };
}

export function eloMatchModel(ratings: Ratings): MatchModel {
  return {
    lambdas(home, away, hostCountry) {
      const ha = hostCountry
        ? netHomeAdvantage({ hostCountry }, home, away)
        : 0;
      return lambdasFor(ratings[home], ratings[away], ha);
    },
  };
}

export function matrixMatchModel(
  matrix: LambdaMatrix = COMMITTED_MATRIX,
  fallback?: MatchModel
): MatchModel {
  return {
    lambdas(home, away, hostCountry) {
      const m = matrixLambdas(matrix, home, away, hostCountry);
      if (m) return m;
      if (fallback) return fallback.lambdas(home, away, hostCountry);
      throw new Error(`lambda matrix missing entry for ${home} vs ${away}`);
    },
  };
}

/**
 * Default model: the ML matrix when available, otherwise the Elo formula.
 * `ratings` is used only for the fallback.
 */
export function defaultMatchModel(ratings: Ratings): MatchModel {
  if (hasMatrix()) return matrixMatchModel(COMMITTED_MATRIX, eloMatchModel(ratings));
  return eloMatchModel(ratings);
}
