import { GOALS_MULTIPLIER } from "@/lib/constants";
import type { HostCountry, TeamId } from "@/lib/types";
import committed from "@/public/artifacts/lambda_matrix.latest.json";

/**
 * The offline ML artifact: a 48x48 matrix of predicted (λ_home, λ_away) for
 * every ordered team pair at a neutral venue, produced by the Python LightGBM
 * pipeline (see ml/). The host boost is an additive log-λ bump applied to a
 * host nation playing in its own country. This replaces the Elo→λ formula as
 * the strength model; lib/model/goals.ts remains the fallback.
 */
export interface LambdaMatrix {
  version: string;
  teams: TeamId[];
  neutral: Record<TeamId, Record<TeamId, [number, number]>>;
  host_boost: number;
  dc_rho: number;
  temperature: number;
  lambda_clamp: [number, number];
}

export const COMMITTED_MATRIX = committed as unknown as LambdaMatrix;

const HOST_TEAM: Record<HostCountry, TeamId> = {
  "United States": "USA",
  Mexico: "MEX",
  Canada: "CAN",
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function hasMatrix(matrix: LambdaMatrix = COMMITTED_MATRIX): boolean {
  return !!matrix && !!matrix.neutral && matrix.teams?.length === 48;
}

/**
 * Look up (λ_home, λ_away) for a matchup, applying the host boost when a host
 * nation plays at home. Returns null if the pair is missing from the matrix.
 */
export function matrixLambdas(
  matrix: LambdaMatrix,
  home: TeamId,
  away: TeamId,
  hostCountry: HostCountry | null
): { lambdaHome: number; lambdaAway: number } | null {
  const pair = matrix.neutral[home]?.[away];
  if (!pair) return null;
  let lh = pair[0] * GOALS_MULTIPLIER;
  let la = pair[1] * GOALS_MULTIPLIER;
  if (hostCountry) {
    const host = HOST_TEAM[hostCountry];
    if (home === host) lh = Math.exp(Math.log(lh) + matrix.host_boost);
    if (away === host) la = Math.exp(Math.log(la) + matrix.host_boost);
  }
  const [lo, hi] = matrix.lambda_clamp;
  return { lambdaHome: clamp(lh, lo, hi), lambdaAway: clamp(la, lo, hi) };
}

/**
 * Return a copy of the matrix with a calibration temperature applied to each
 * matchup's goal spread: λ' = λ̄ + T·(λ − λ̄). T<1 compresses toward parity
 * (fewer blowouts → lower favorite title odds); T>1 sharpens. Used by
 * scripts/calibrate-matrix.ts to hit the pro-forecaster favorite band.
 */
export function applyTemperature(matrix: LambdaMatrix, t: number): LambdaMatrix {
  const [lo, hi] = matrix.lambda_clamp;
  const neutral: LambdaMatrix["neutral"] = {};
  for (const i of matrix.teams) {
    neutral[i] = {};
    for (const j of matrix.teams) {
      if (i === j) continue;
      const [lh, la] = matrix.neutral[i][j];
      const mean = (lh + la) / 2;
      neutral[i][j] = [
        Math.round(clamp(mean + t * (lh - mean), lo, hi) * 100) / 100,
        Math.round(clamp(mean + t * (la - mean), lo, hi) * 100) / 100,
      ];
    }
  }
  return { ...matrix, neutral, temperature: t };
}
