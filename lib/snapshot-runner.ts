import { fifaRankPoints, simulate } from "@/lib/engine";
import { getMatchData, playedMatches } from "@/lib/data/fixtures";
import { blendedPreTournamentRatings } from "@/lib/data/ratings";
import { buildSnapshot, snapshotStore } from "@/lib/data/snapshots";
import type { Snapshot } from "@/lib/types";

/**
 * Run the current prediction and persist it as today's snapshot. Computes the
 * sim directly (no unstable_cache) so it works both in the cron route and the
 * standalone `pnpm snapshot` CLI.
 */
export async function captureSnapshot(now: Date): Promise<Snapshot> {
  const matchData = await getMatchData();
  const result = simulate(
    matchData.matches,
    blendedPreTournamentRatings(),
    fifaRankPoints
  );
  const date = now.toISOString().slice(0, 10);
  const snapshot = buildSnapshot(
    date,
    now.toISOString(),
    result.seed,
    result.simCount,
    playedMatches(matchData.matches).length,
    result.odds
  );
  await snapshotStore.save(snapshot);
  return snapshot;
}
