import fs from "node:fs";
import path from "node:path";
import { snapshotSchema } from "@/lib/data/schemas";
import type { Snapshot } from "@/lib/types";

export interface SnapshotStore {
  save(snapshot: Snapshot): Promise<void>;
  loadAll(): Promise<Snapshot[]>;
}

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "snapshots");

/**
 * Filesystem-backed snapshot store: one JSON per day under data/snapshots/.
 * Works locally and in any writable-FS deployment. On Vercel (read-only FS)
 * save() throws a clear, actionable error; loadAll() degrades to [].
 */
export class FsSnapshotStore implements SnapshotStore {
  async save(snapshot: Snapshot): Promise<void> {
    if (process.env.VERCEL) {
      throw new Error(
        "FsSnapshotStore can't write on Vercel (read-only FS). " +
          "Run `pnpm snapshot` locally and commit the JSON, or add a BlobSnapshotStore."
      );
    }
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const file = path.join(SNAPSHOT_DIR, `${snapshot.date}.json`);
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  }

  async loadAll(): Promise<Snapshot[]> {
    if (!fs.existsSync(SNAPSHOT_DIR)) return [];
    const snapshots: Snapshot[] = [];
    for (const name of fs.readdirSync(SNAPSHOT_DIR)) {
      if (!name.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(SNAPSHOT_DIR, name), "utf-8")
        );
        const parsed = snapshotSchema.safeParse(raw);
        if (parsed.success) snapshots.push(parsed.data);
      } catch {
        // skip malformed snapshot files
      }
    }
    return snapshots.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
}

export const snapshotStore: SnapshotStore = new FsSnapshotStore();

/** Build a Snapshot from a sim result for a given date. */
export function buildSnapshot(
  date: string,
  generatedAt: string,
  seed: number,
  simCount: number,
  playedMatches: number,
  odds: Snapshot["odds"]
): Snapshot {
  return { date, generatedAt, seed, simCount, playedMatches, odds };
}
