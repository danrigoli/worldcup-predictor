import type { GroupLetter, Ratings, TeamId } from "@/lib/types";

export interface PlayedGroupMatch {
  home: TeamId;
  away: TeamId;
  homeScore: number;
  awayScore: number;
}

export interface TeamStanding {
  team: TeamId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/** Per-team stats counting only matches where both sides are in `teamSet`. */
function statsAmong(
  teams: TeamId[],
  teamSet: Set<TeamId>,
  matches: PlayedGroupMatch[]
): Map<TeamId, TeamStanding> {
  const table = new Map<TeamId, TeamStanding>();
  for (const team of teams) {
    table.set(team, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }
  for (const m of matches) {
    if (!teamSet.has(m.home) || !teamSet.has(m.away)) continue;
    const h = table.get(m.home)!;
    const a = table.get(m.away)!;
    h.played++;
    a.played++;
    h.gf += m.homeScore;
    h.ga += m.awayScore;
    a.gf += m.awayScore;
    a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.won++;
      a.lost++;
      h.points += 3;
    } else if (m.homeScore < m.awayScore) {
      a.won++;
      h.lost++;
      a.points += 3;
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
    }
  }
  for (const s of table.values()) s.gd = s.gf - s.ga;
  return table;
}

/**
 * Sort a still-tied subset by overall (whole-group) GD → GF → conduct (no-op,
 * card data unavailable) → FIFA ranking (lower rank index = stronger).
 */
function byOverall(
  teams: TeamId[],
  overall: Map<TeamId, TeamStanding>,
  fifaRank: Ratings
): TeamId[] {
  return [...teams].sort((x, y) => {
    const sx = overall.get(x)!;
    const sy = overall.get(y)!;
    if (sy.gd !== sx.gd) return sy.gd - sx.gd;
    if (sy.gf !== sx.gf) return sy.gf - sx.gf;
    // conduct: equal (no-op)
    return (fifaRank[y] ?? 0) - (fifaRank[x] ?? 0); // higher FIFA points first
  });
}

function groupByKey(teams: TeamId[], key: (t: TeamId) => string): TeamId[][] {
  const buckets = new Map<string, TeamId[]>();
  const order: string[] = [];
  for (const t of teams) {
    const k = key(t);
    if (!buckets.has(k)) {
      buckets.set(k, []);
      order.push(k);
    }
    buckets.get(k)!.push(t);
  }
  return order.map((k) => buckets.get(k)!);
}

/**
 * Head-to-head ranking among an equal-points subset (2026 rule: H2H applied
 * before overall GD). Recurses into still-tied subsets so the mini-table is
 * recomputed for the smaller group, per FIFA regulations.
 */
const H2H_CRITERIA: Array<(s: TeamStanding) => number> = [
  (s) => s.points,
  (s) => s.gd,
  (s) => s.gf,
];

function rankByHeadToHead(
  tied: TeamId[],
  allMatches: PlayedGroupMatch[],
  overall: Map<TeamId, TeamStanding>,
  fifaRank: Ratings
): TeamId[] {
  if (tied.length === 1) return tied;
  // Mini-table recomputed over ONLY the currently-tied teams.
  const h2h = statsAmong(tied, new Set(tied), allMatches);

  // Apply the head-to-head criteria strictly in sequence. The first criterion
  // that separates anyone is used to split; each resulting still-level subgroup
  // is then re-ranked FROM criterion 1 with its own freshly recomputed
  // mini-table (FIFA's recursion — the GD/GF among a smaller subgroup can
  // differ from the GD/GF over the full tied set).
  for (const crit of H2H_CRITERIA) {
    const sorted = [...tied].sort(
      (x, y) => crit(h2h.get(y)!) - crit(h2h.get(x)!)
    );
    const buckets = groupByKey(sorted, (t) => `${crit(h2h.get(t)!)}`);
    if (buckets.length > 1) {
      const result: TeamId[] = [];
      for (const bucket of buckets) {
        result.push(...rankByHeadToHead(bucket, allMatches, overall, fifaRank));
      }
      return result;
    }
  }

  // No head-to-head criterion separated anyone → overall GD/GF/FIFA ranking.
  return byOverall(tied, overall, fifaRank);
}

/**
 * Final group ranking: overall points first, then 2026 head-to-head chain.
 * `teams` are the 4 group members; `matches` are their 6 group results.
 */
export function rankGroup(
  teams: TeamId[],
  matches: PlayedGroupMatch[],
  fifaRank: Ratings
): TeamId[] {
  const set = new Set(teams);
  const overall = statsAmong(teams, set, matches);

  const byPoints = [...teams].sort(
    (x, y) => overall.get(y)!.points - overall.get(x)!.points
  );
  const pointBuckets = groupByKey(byPoints, (t) => `${overall.get(t)!.points}`);

  const result: TeamId[] = [];
  for (const bucket of pointBuckets) {
    if (bucket.length === 1) result.push(bucket[0]);
    else result.push(...rankByHeadToHead(bucket, matches, overall, fifaRank));
  }
  return result;
}

export interface GroupStandings {
  group: GroupLetter;
  rows: TeamStanding[]; // ordered by final rank
}

/** Full standings (stats + final order) for one group, for display + sim. */
export function computeGroupStandings(
  group: GroupLetter,
  teams: TeamId[],
  matches: PlayedGroupMatch[],
  fifaRank: Ratings
): GroupStandings {
  const overall = statsAmong(teams, new Set(teams), matches);
  const ranked = rankGroup(teams, matches, fifaRank);
  return {
    group,
    rows: ranked.map((t) => overall.get(t)!),
  };
}
