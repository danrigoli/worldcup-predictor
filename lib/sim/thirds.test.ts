import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  allocateThirds,
  rankThirds,
  type ThirdPlaceTeam,
  type ThirdSlot,
} from "./thirds";
import type { GroupLetter, TeamId } from "@/lib/types";
import type { TeamStanding } from "./groups";

const ROOT = path.join(__dirname, "..", "..");

function standing(team: TeamId, points: number, gd: number, gf: number): TeamStanding {
  return { team, played: 3, won: 0, drawn: 0, lost: 0, gf, ga: gf - gd, gd, points };
}

function third(team: TeamId, group: GroupLetter, pts: number, gd: number, gf: number): ThirdPlaceTeam {
  return { team, group, standing: standing(team, pts, gd, gf) };
}

/** The 8 third-pool R32 slots, read from the committed fixtures seed. */
function feedThirdSlots(): ThirdSlot[] {
  const fixtures = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/seeds/fixtures-2026.json"), "utf-8")
  );
  const slots: ThirdSlot[] = [];
  for (const m of fixtures.matches) {
    for (const side of [m.home, m.away]) {
      if (side.kind === "third-pool") {
        slots.push({ matchNumber: m.matchNumber, pool: side.groups });
      }
    }
  }
  return slots;
}

describe("rankThirds", () => {
  it("orders by points, then GD, then GF", () => {
    const thirds = [
      third("T1", "A", 3, 0, 2),
      third("T2", "B", 4, 1, 3),
      third("T3", "C", 4, 2, 2),
      third("T4", "D", 4, 2, 5),
    ];
    const ranked = rankThirds(thirds, {}).map((t) => t.team);
    // T4 (4,2,5) > T3 (4,2,2) > T2 (4,1,3) > T1 (3,..)
    expect(ranked).toEqual(["T4", "T3", "T2", "T1"]);
  });
});

describe("allocateThirds (against the real feed pools)", () => {
  const slots = feedThirdSlots();

  it("the feed has exactly 8 third-pool slots", () => {
    expect(slots).toHaveLength(8);
  });

  it("assigns 8 thirds bijectively, each within its pool", () => {
    // Pick a plausible set of 8 qualifying groups.
    const groups: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const thirds = groups.map((g, i) => third(`T_${g}`, g, 4 - (i % 2), 1, 3));
    const ranked = rankThirds(thirds, {});
    const assignment = allocateThirds(ranked, slots);
    expect(assignment).not.toBeNull();
    expect(assignment!.size).toBe(8);

    // Bijective: 8 distinct teams.
    const assignedTeams = new Set(assignment!.values());
    expect(assignedTeams.size).toBe(8);

    // Each assigned team's group is in that slot's pool.
    const slotByNumber = new Map(slots.map((s) => [s.matchNumber, s]));
    const groupByTeam = new Map(thirds.map((t) => [t.team, t.group]));
    for (const [matchNumber, team] of assignment!) {
      const pool = slotByNumber.get(matchNumber)!.pool;
      expect(pool).toContain(groupByTeam.get(team));
    }
  });

  it("is deterministic", () => {
    const groups: GroupLetter[] = ["C", "D", "E", "F", "G", "H", "I", "J"];
    const thirds = groups.map((g) => third(`T_${g}`, g, 3, 0, 2));
    const ranked = rankThirds(thirds, {});
    const a = allocateThirds(ranked, slots);
    const b = allocateThirds(ranked, slots);
    expect([...a!.entries()]).toEqual([...b!.entries()]);
  });

  it("solves a pool-constrained case that requires backtracking", () => {
    // Tightly constrained synthetic pools forcing the solver to backtrack.
    const tightSlots: ThirdSlot[] = [
      { matchNumber: 1, pool: ["A", "B"] },
      { matchNumber: 2, pool: ["A"] },
      { matchNumber: 3, pool: ["A", "B", "C"] },
    ];
    const thirds = [
      third("TA", "A", 3, 0, 1),
      third("TB", "B", 3, 0, 1),
      third("TC", "C", 3, 0, 1),
    ];
    const assignment = allocateThirds(thirds, tightSlots);
    expect(assignment).not.toBeNull();
    // Slot 2 can only take A; slot 1 then takes B; slot 3 takes C.
    expect(assignment!.get(2)).toBe("TA");
    expect(assignment!.get(1)).toBe("TB");
    expect(assignment!.get(3)).toBe("TC");
  });

  it("returns null when no perfect matching exists", () => {
    const impossible: ThirdSlot[] = [
      { matchNumber: 1, pool: ["A"] },
      { matchNumber: 2, pool: ["A"] },
    ];
    const thirds = [third("TA", "A", 3, 0, 1), third("TB", "B", 3, 0, 1)];
    expect(allocateThirds(thirds, impossible)).toBeNull();
  });
});
