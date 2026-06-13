/**
 * Capture today's prediction snapshot to data/snapshots/. Run each matchday:
 *   pnpm snapshot
 */
import { captureSnapshot } from "../lib/snapshot-runner";

captureSnapshot(new Date())
  .then((s) => {
    console.log(
      `✓ snapshot ${s.date}: ${s.playedMatches} matches played, ${s.simCount} sims`
    );
  })
  .catch((e) => {
    console.error("Snapshot failed:", e);
    process.exit(1);
  });
