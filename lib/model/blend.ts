import { BLEND_WEIGHTS, RATING_SHRINKAGE } from "@/lib/constants";
import type { Ratings, TeamId } from "@/lib/types";

function zScores(values: Map<TeamId, number>): Map<TeamId, number> {
  const xs = [...values.values()];
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(
    xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length
  );
  const out = new Map<TeamId, number>();
  for (const [id, v] of values) out.set(id, sd > 0 ? (v - mean) / sd : 0);
  return out;
}

/**
 * Blend Elo, FIFA points and log(squad market value) into a single
 * Elo-scale strength rating per team. Signals are z-scored across the 48
 * teams; teams missing a market value fall back to elo/fifa renormalized.
 */
export function blendRatings(
  teamIds: TeamId[],
  elo: Ratings,
  fifaPoints: Ratings,
  valuesEur: Partial<Ratings>
): Ratings {
  const eloMap = new Map(teamIds.map((id) => [id, elo[id]]));
  const fifaMap = new Map(teamIds.map((id) => [id, fifaPoints[id]]));
  const valueMap = new Map(
    teamIds
      .filter((id) => typeof valuesEur[id] === "number" && valuesEur[id]! > 0)
      .map((id) => [id, Math.log(valuesEur[id]!)])
  );

  const zElo = zScores(eloMap);
  const zFifa = zScores(fifaMap);
  const zValue = zScores(valueMap);

  const eloXs = [...eloMap.values()];
  const eloMean = eloXs.reduce((a, b) => a + b, 0) / eloXs.length;
  const eloSdRaw = Math.sqrt(
    eloXs.reduce((a, b) => a + (b - eloMean) ** 2, 0) / eloXs.length
  );
  // Floor the back-mapping scale so degenerate (all-equal) Elo input
  // still lets the other signals separate teams.
  const eloSd = eloSdRaw > 1 ? eloSdRaw : 1;

  const { elo: we, fifa: wf, value: wv } = BLEND_WEIGHTS;
  const blended: Ratings = {};
  for (const id of teamIds) {
    let s: number;
    if (zValue.has(id)) {
      s = we * zElo.get(id)! + wf * zFifa.get(id)! + wv * zValue.get(id)!;
    } else {
      const total = we + wf;
      s = (we / total) * zElo.get(id)! + (wf / total) * zFifa.get(id)!;
    }
    // Shrink deviations from the field mean toward it (model uncertainty).
    blended[id] = eloMean + s * eloSd * RATING_SHRINKAGE;
  }
  return blended;
}
