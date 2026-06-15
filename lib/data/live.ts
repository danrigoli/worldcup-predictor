import { fetchEspnDay } from "@/lib/data/espn";
import type { LiveByMatch, LiveInfo, Match, TeamId } from "@/lib/types";

/** Today's scoreboard refreshes fast (live); finished days are stable. */
const TODAY_REVALIDATE = 20;
const PAST_REVALIDATE = 3600;
/** Bound on distinct ESPN dates fetched per request (most recent kept). */
const MAX_DATES = 24;

function utcStamp(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

/** YYYYMMDD one UTC day before the given stamp. */
function priorStamp(stamp: string): string {
  const y = Number(stamp.slice(0, 4));
  const m = Number(stamp.slice(4, 6));
  const d = Number(stamp.slice(6, 8));
  return utcStamp(new Date(Date.UTC(y, m - 1, d - 1)));
}

/** Unordered team-pair key for matching ESPN events to scheduled matches. */
function pairKey(a: TeamId, b: TeamId): string {
  return [a, b].sort().join("-");
}

/**
 * Live status (in-progress flag, live score, clock, stats) per match number,
 * from the ESPN scoreboard. Matched to the schedule by unordered team pair.
 *
 * We query: today + yesterday (UTC) for live/just-finished matches, PLUS the
 * exact UTC date of every already-played match (and the day before, since ESPN
 * buckets late-UTC kickoffs under the prior US date) so stats appear for
 * finished matches regardless of the current date. Never throws.
 */
export async function getLiveMatches(matches: Match[]): Promise<LiveByMatch> {
  const byPair = new Map<string, number>();
  for (const m of matches) {
    if (m.home.kind === "team" && m.away.kind === "team") {
      byPair.set(pairKey(m.home.team, m.away.team), m.matchNumber);
    }
  }

  // stamp -> revalidate (keep the shortest = freshest when a date appears twice)
  const dates = new Map<string, number>();
  const add = (stamp: string, rev: number) => {
    const cur = dates.get(stamp);
    if (cur === undefined || rev < cur) dates.set(stamp, rev);
  };

  const now = new Date();
  add(utcStamp(now), TODAY_REVALIDATE);
  add(utcStamp(new Date(now.getTime() - 86_400_000)), PAST_REVALIDATE);

  for (const m of matches) {
    if (m.homeScore !== null && m.awayScore !== null) {
      const stamp = m.dateUtc.slice(0, 10).replace(/-/g, "");
      add(stamp, PAST_REVALIDATE);
      add(priorStamp(stamp), PAST_REVALIDATE);
    }
  }

  // Most-recent dates first, bounded.
  const ordered = [...dates.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, MAX_DATES);

  const out: LiveByMatch = {};
  try {
    const days = await Promise.all(
      ordered.map(([stamp, rev]) => fetchEspnDay(stamp, rev))
    );
    for (const day of days) {
      for (const e of day) {
        const matchNumber = byPair.get(pairKey(e.home, e.away));
        if (matchNumber === undefined) continue;
        const sched = matches.find((m) => m.matchNumber === matchNumber)!;
        const flip = sched.home.kind === "team" && sched.home.team !== e.home;
        const info: LiveInfo = {
          state: e.state,
          detail: e.detail,
          clock: e.clock,
          homeScore: flip ? e.awayScore : e.homeScore,
          awayScore: flip ? e.homeScore : e.awayScore,
          stats: e.stats
            ? {
                home: flip ? e.stats.away : e.stats.home,
                away: flip ? e.stats.home : e.stats.away,
              }
            : null,
        };
        // Prefer in-progress / a richer entry over a stale "pre" placeholder.
        const existing = out[matchNumber];
        if (!existing || existing.state === "pre" || (!existing.stats && info.stats)) {
          out[matchNumber] = info;
        }
      }
    }
  } catch {
    return out;
  }
  return out;
}
