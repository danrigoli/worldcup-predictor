import { describe, expect, it } from "vitest";
import { rankGroup, type PlayedGroupMatch } from "./groups";

const teams = ["AAA", "BBB", "CCC", "DDD"];
const fifa = { AAA: 1000, BBB: 900, CCC: 800, DDD: 700 };

describe("rankGroup", () => {
  it("ranks by points first", () => {
    const matches: PlayedGroupMatch[] = [
      { home: "AAA", away: "BBB", homeScore: 1, awayScore: 0 },
      { home: "CCC", away: "DDD", homeScore: 2, awayScore: 0 },
      { home: "AAA", away: "CCC", homeScore: 1, awayScore: 0 },
      { home: "BBB", away: "DDD", homeScore: 3, awayScore: 0 },
      { home: "AAA", away: "DDD", homeScore: 1, awayScore: 0 },
      { home: "BBB", away: "CCC", homeScore: 1, awayScore: 0 },
    ];
    // AAA 9, BBB 6, CCC 3, DDD 0
    expect(rankGroup(teams, matches, fifa)).toEqual(["AAA", "BBB", "CCC", "DDD"]);
  });

  it("uses head-to-head GD BEFORE overall GD (2026 rule)", () => {
    // 3-way tie on 6 pts among AAA/BBB/CCC (each beats DDD + a cycle vs
    // each other). Overall GD favors BBB & CCC (big wins over DDD), but the
    // head-to-head mini-table is decisive first: BBB beat CCC 9-0, so within
    // the cycle H2H GD ranks BBB > AAA > CCC regardless of overall GD.
    const matches: PlayedGroupMatch[] = [
      { home: "AAA", away: "DDD", homeScore: 1, awayScore: 0 },
      { home: "BBB", away: "DDD", homeScore: 1, awayScore: 0 },
      { home: "CCC", away: "DDD", homeScore: 1, awayScore: 0 },
      { home: "AAA", away: "BBB", homeScore: 1, awayScore: 0 }, // AAA beat BBB
      { home: "CCC", away: "AAA", homeScore: 1, awayScore: 0 }, // CCC beat AAA
      { home: "BBB", away: "CCC", homeScore: 9, awayScore: 0 }, // BBB crush CCC
    ];
    // Points: AAA 6, BBB 6, CCC 6, DDD 0 → 3-way tie on 6.
    // H2H points all 3 each → tie; H2H GD: BBB +8, AAA 0, CCC -8.
    const ranked = rankGroup(teams, matches, fifa);
    expect(ranked).toEqual(["BBB", "AAA", "CCC", "DDD"]);
  });

  it("head-to-head beats a superior overall GD in a 2-way tie", () => {
    // AAA & BBB both finish on 6 pts. BBB has a far better overall GD, but
    // AAA won the head-to-head — under the 2026 H2H-first rule AAA ranks above.
    const matches: PlayedGroupMatch[] = [
      { home: "AAA", away: "BBB", homeScore: 1, awayScore: 0 }, // AAA beat BBB
      { home: "AAA", away: "CCC", homeScore: 0, awayScore: 1 }, // AAA lost CCC
      { home: "BBB", away: "CCC", homeScore: 1, awayScore: 0 },
      { home: "AAA", away: "DDD", homeScore: 1, awayScore: 0 },
      { home: "BBB", away: "DDD", homeScore: 7, awayScore: 0 }, // BBB huge GD
      { home: "CCC", away: "DDD", homeScore: 0, awayScore: 1 }, // DDD beat CCC
    ];
    // Points: AAA 6 (BBB,DDD), BBB 6 (CCC,DDD), CCC 3 (AAA), DDD 3 (CCC).
    // AAA & BBB tie on 6. H2H: AAA beat BBB → AAA first despite BBB's GD.
    const ranked = rankGroup(teams, matches, fifa);
    expect(ranked[0]).toBe("AAA");
    expect(ranked[1]).toBe("BBB");
  });

  it("recomputes the mini-table per subgroup (sequential criteria, not a collapsed triple)", () => {
    // 3-way cycle tied on 6 group points; head-to-head points/GD/GF are all
    // identical (a balanced 1-0 cycle), so H2H cannot separate anyone and the
    // tie must fall to OVERALL GD — driven by the lopsided wins over DDD.
    const matches: PlayedGroupMatch[] = [
      { home: "AAA", away: "BBB", homeScore: 1, awayScore: 0 },
      { home: "BBB", away: "CCC", homeScore: 1, awayScore: 0 },
      { home: "CCC", away: "AAA", homeScore: 1, awayScore: 0 },
      { home: "AAA", away: "DDD", homeScore: 5, awayScore: 0 }, // AAA best overall GD
      { home: "BBB", away: "DDD", homeScore: 1, awayScore: 0 },
      { home: "CCC", away: "DDD", homeScore: 2, awayScore: 0 }, // CCC > BBB overall
    ];
    // H2H {A,B,C}: each 3 pts, GD 0, GF 1 → fully level → overall GD:
    // AAA +5, CCC +2, BBB +1 → AAA, CCC, BBB, then DDD.
    expect(rankGroup(teams, matches, fifa)).toEqual(["AAA", "CCC", "BBB", "DDD"]);
  });

  it("falls back to FIFA ranking when all else is equal", () => {
    // Everyone draws 0-0 → identical on every metric except FIFA points.
    const matches: PlayedGroupMatch[] = [
      { home: "AAA", away: "BBB", homeScore: 0, awayScore: 0 },
      { home: "AAA", away: "CCC", homeScore: 0, awayScore: 0 },
      { home: "AAA", away: "DDD", homeScore: 0, awayScore: 0 },
      { home: "BBB", away: "CCC", homeScore: 0, awayScore: 0 },
      { home: "BBB", away: "DDD", homeScore: 0, awayScore: 0 },
      { home: "CCC", away: "DDD", homeScore: 0, awayScore: 0 },
    ];
    expect(rankGroup(teams, matches, fifa)).toEqual(["AAA", "BBB", "CCC", "DDD"]);
  });
});
