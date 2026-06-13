import type { GroupLetter, Ratings, TeamId } from "@/lib/types";
import type { TeamStanding } from "@/lib/sim/groups";

export interface ThirdPlaceTeam {
  team: TeamId;
  group: GroupLetter;
  standing: TeamStanding;
}

/**
 * Rank the 12 third-placed teams: points → GD → goals → conduct (no-op) →
 * FIFA ranking. Returns all 12 ordered; the first 8 advance.
 */
export function rankThirds(
  thirds: ThirdPlaceTeam[],
  fifaRank: Ratings
): ThirdPlaceTeam[] {
  return [...thirds].sort((x, y) => {
    const a = x.standing;
    const b = y.standing;
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return (fifaRank[y.team] ?? 0) - (fifaRank[x.team] ?? 0);
  });
}

export interface ThirdSlot {
  /** R32 match number this slot belongs to (for stable ordering). */
  matchNumber: number;
  /** Eligible groups for the third-placed team in this slot. */
  pool: GroupLetter[];
}

/**
 * Assign the 8 qualifying thirds to the 8 third-pool R32 slots such that each
 * third lands in a slot whose pool includes its group (bijective). Solved as
 * a perfect bipartite matching with deterministic backtracking: slots in fixed
 * match-number order, candidates tried in seeding (rank) order. FIFA's official
 * allocation table is exactly the set of such pool-constrained matchings.
 */
export function allocateThirds(
  qualifyingThirds: ThirdPlaceTeam[],
  slots: ThirdSlot[]
): Map<number, TeamId> | null {
  const orderedSlots = [...slots].sort((a, b) => a.matchNumber - b.matchNumber);
  const assignment = new Map<number, TeamId>();
  const usedGroups = new Set<GroupLetter>();

  const thirdByGroup = new Map<GroupLetter, ThirdPlaceTeam>();
  for (const t of qualifyingThirds) thirdByGroup.set(t.group, t);

  const solve = (slotIdx: number): boolean => {
    if (slotIdx === orderedSlots.length) return true;
    const slot = orderedSlots[slotIdx];
    // Try eligible groups in the rank order of qualifyingThirds (deterministic).
    for (const third of qualifyingThirds) {
      if (usedGroups.has(third.group)) continue;
      if (!slot.pool.includes(third.group)) continue;
      assignment.set(slot.matchNumber, third.team);
      usedGroups.add(third.group);
      if (solve(slotIdx + 1)) return true;
      assignment.delete(slot.matchNumber);
      usedGroups.delete(third.group);
    }
    return false;
  };

  return solve(0) ? assignment : null;
}
