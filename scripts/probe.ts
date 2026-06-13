import { rankGroup, computeGroupStandings, type PlayedGroupMatch } from "@/lib/sim/groups";

const teams = ["AAA", "BBB", "CCC", "DDD"];
const fifa = { AAA: 1000, BBB: 900, CCC: 800, DDD: 700 };

function show(label: string, matches: PlayedGroupMatch[]) {
  const ranked = rankGroup(teams, matches, fifa);
  const st = computeGroupStandings("A", teams, matches, fifa);
  console.log(label, "RANKED", ranked);
  console.log(label, "ST", st.rows.map(r=>({t:r.team,p:r.points,gd:r.gd,gf:r.gf})));
}

show("CASE1", [
  { home: "AAA", away: "DDD", homeScore: 5, awayScore: 0 },
  { home: "BBB", away: "DDD", homeScore: 1, awayScore: 0 },
  { home: "CCC", away: "DDD", homeScore: 1, awayScore: 0 },
  { home: "AAA", away: "CCC", homeScore: 1, awayScore: 0 },
  { home: "BBB", away: "CCC", homeScore: 1, awayScore: 0 },
  { home: "AAA", away: "BBB", homeScore: 2, awayScore: 2 },
]);

// 4-way: full cycle of 1-0 plus two 0-0 draws -> everyone 4 pts (2 results each? round robin = 3 games each)
show("CASE2", [
  { home: "AAA", away: "BBB", homeScore: 1, awayScore: 0 },
  { home: "BBB", away: "CCC", homeScore: 1, awayScore: 0 },
  { home: "CCC", away: "DDD", homeScore: 1, awayScore: 0 },
  { home: "DDD", away: "AAA", homeScore: 1, awayScore: 0 },
  { home: "AAA", away: "CCC", homeScore: 0, awayScore: 0 },
  { home: "BBB", away: "DDD", homeScore: 0, awayScore: 0 },
]);

// CASE3: 3-way tie A,B,C on points. 3-way H2H mini-table separates C as top,
// leaving {A,B} tied on H2H points/gd/gf in the 3-way table, but the A-B direct
// result favors B. Correct FIFA = within {A,B} recompute (only A-B) => B>A.
// Build: C beat A big, A beat B small, B beat C small => cycle.
show("CASE3", [
  { home: "AAA", away: "DDD", homeScore: 1, awayScore: 0 },
  { home: "BBB", away: "DDD", homeScore: 1, awayScore: 0 },
  { home: "CCC", away: "DDD", homeScore: 1, awayScore: 0 },
  { home: "CCC", away: "AAA", homeScore: 3, awayScore: 0 }, // C beat A 3-0
  { home: "AAA", away: "BBB", homeScore: 1, awayScore: 0 }, // A beat B 1-0
  { home: "BBB", away: "CCC", homeScore: 1, awayScore: 0 }, // B beat C 1-0
]);
// 3-way H2H (A,B,C only): each 3 pts (one win one loss). GD: A: -3+1=-2, B:-1+1=0, C:+3-1=+2.
// So C top (gd+2), B mid (0), A bottom (-2). All separate by H2H GD -> no recursion needed.
// Expected: C, B, A, D.

// CASE4: force a {A,B} sub-tie inside 3-way where A-B direct flips vs nothing.
// A,B,C tie 3-way on H2H pts & gd & gf except A&B identical, C different.
// C beats both? then C has 6 h2h pts, not tied. Need: all 3 drew each other 0-0 except differ vs D.
// That makes H2H identical for all 3 -> bucket == tied.length -> overall. Not partial. skip.
