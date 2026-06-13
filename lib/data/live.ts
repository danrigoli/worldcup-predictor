import { fetchEspnDay } from "@/lib/data/espn";
import type { LiveByMatch, LiveInfo, Match, TeamId } from "@/lib/types";

/** Today's scoreboard refreshes ~each minute; finished days are stable. */
const TODAY_REVALIDATE = 45;
const PAST_REVALIDATE = 3600;
/** Rolling window (days incl. today) to pull live status + recent stats for. */
const WINDOW_DAYS = 4;

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
 * from the ESPN scoreboard for today + yesterday (UTC). Matched to the schedule
 * by unordered team pair. Never throws — returns {} on any failure so the page
 * always renders.
 */
export async function getLiveMatches(matches: Match[]): Promise<LiveByMatch> {
  // Map team-pair → matchNumber for group/known matches.
  const byPair = new Map<string, number>();
  for (const m of matches) {
    if (m.home.kind === "team" && m.away.kind === "team") {
      byPair.set(pairKey(m.home.team, m.away.team), m.matchNumber);
    }
  }

  const now = new Date();
  // today + previous (WINDOW_DAYS-1) UTC days; today fetched fresh, rest cached.
  const dates = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    return { stamp: utcStamp(d), revalidate: i === 0 ? TODAY_REVALIDATE : PAST_REVALIDATE };
  });

  const out: LiveByMatch = {};
  try {
    const days = await Promise.all(
      dates.map((d) => fetchEspnDay(d.stamp, d.revalidate))
    );
    for (const day of days) {
      for (const e of day) {
        const matchNumber = byPair.get(pairKey(e.home, e.away));
        if (matchNumber === undefined) continue;
        // Orient ESPN scores/stats to the scheduled home/away.
        const sched = matches.find((m) => m.matchNumber === matchNumber)!;
        const flip =
          sched.home.kind === "team" && sched.home.team !== e.home;
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
        // Prefer the freshest signal (in-progress over a stale "pre").
        const existing = out[matchNumber];
        if (!existing || existing.state === "pre") out[matchNumber] = info;
      }
    }
  } catch {
    return out;
  }
  return out;
}
