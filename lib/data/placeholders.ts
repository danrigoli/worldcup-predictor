import { resolveTeam } from "@/lib/names";
import type { GroupLetter, Slot } from "@/lib/types";

const GROUP_LETTERS = new Set("ABCDEFGHIJKL".split(""));

/**
 * Parse a side string from the fixture feed into a Slot.
 * Handles, as pinned from the captured feeds:
 *  - real team names ("Mexico", "Korea Republic")
 *  - group ranks: "1A", "2C"
 *  - third-place pools: "3ABCDF" (fixturedownload), "3A/B/C/D/F" (openfootball)
 *  - knockout refs: "W73", "L101" (openfootball style)
 * Returns null for unknowns ("To be announced").
 */
export function parseSlot(raw: string): Slot | null {
  const s = raw.trim();

  const rank = /^([12])([A-L])$/.exec(s);
  if (rank) {
    return {
      kind: "group-rank",
      group: rank[2] as GroupLetter,
      rank: Number(rank[1]) as 1 | 2,
    };
  }

  const third = /^3([A-L/]+)$/.exec(s);
  if (third) {
    const groups = third[1]
      .split("")
      .filter((c) => GROUP_LETTERS.has(c)) as GroupLetter[];
    if (groups.length >= 2) return { kind: "third-pool", groups };
  }

  const winner = /^W(\d{1,3})$/.exec(s);
  if (winner) return { kind: "match-winner", matchNumber: Number(winner[1]) };

  const loser = /^L(\d{1,3})$/.exec(s);
  if (loser) return { kind: "match-loser", matchNumber: Number(loser[1]) };

  const team = resolveTeam(s);
  if (team) return { kind: "team", team };

  return null;
}
