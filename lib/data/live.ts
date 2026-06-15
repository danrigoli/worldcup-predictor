import { TOURNAMENT_START } from "@/lib/constants";
import { fetchEspnDay } from "@/lib/data/espn";
import type { LiveByMatch, LiveInfo, Match, TeamId } from "@/lib/types";

/** Today's scoreboard refreshes fast (live); finished days are stable. */
const TODAY_REVALIDATE = 20;
const PAST_REVALIDATE = 3600;
/** Bound on distinct ESPN dates fetched per request (most recent kept). */
const MAX_DATES = 30;

function utcStamp(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

/** Unordered team-pair key for matching ESPN events to scheduled matches. */
function pairKey(a: TeamId, b: TeamId): string {
  return [a, b].sort().join("-");
}

/**
 * Live status (in-progress flag, live score, clock, stats) per match number,
 * from the ESPN scoreboard. Matched to the schedule by unordered team pair.
 *
 * We query a CONTIGUOUS range of UTC days from the tournament start through
 * today (bounded to the most-recent MAX_DATES). A contiguous range is robust:
 * it covers every played match's stats regardless of which matches the caller
 * knows are finished, and it absorbs ESPN's US-date bucketing of late-UTC
 * kickoffs. Today is fetched fresh; past days are cached. Never throws.
 */
export async function getLiveMatches(matches: Match[]): Promise<LiveByMatch> {
  const byPair = new Map<string, number>();
  for (const m of matches) {
    if (m.home.kind === "team" && m.away.kind === "team") {
      byPair.set(pairKey(m.home.team, m.away.team), m.matchNumber);
    }
  }

  // Contiguous UTC days from one day before the tournament start through today
  // (bounded to the most recent MAX_DATES). The day-before absorbs ESPN's
  // US-date bucketing of late-UTC kickoffs.
  const todayStamp = utcStamp(new Date());
  const d = new Date(TOURNAMENT_START + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  const allDays: string[] = [];
  for (; utcStamp(d) <= todayStamp; d.setUTCDate(d.getUTCDate() + 1)) {
    allDays.push(utcStamp(d));
  }
  const ordered: [string, number][] = allDays
    .slice(-MAX_DATES)
    .map((stamp): [string, number] => [
      stamp,
      stamp === todayStamp ? TODAY_REVALIDATE : PAST_REVALIDATE,
    ])
    .reverse();

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
