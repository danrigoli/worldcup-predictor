import {
  BROWSER_UA,
  FIXTURES_REVALIDATE,
  FIXTURE_FEED_URL,
} from "@/lib/constants";
import { fixtureFeedSchema } from "@/lib/data/schemas";
import { fetchEspnResults } from "@/lib/data/espn";
import { resolveTeam } from "@/lib/names";
import type { Match, TeamId } from "@/lib/types";

import fixturesSeed from "@/data/seeds/fixtures-2026.json";

export interface MatchData {
  matches: Match[];
  source: "live" | "espn-fallback" | "baseline";
  fetchedAt: string;
  /** True when no live source confirmed the baseline (scores may be stale). */
  stale: boolean;
}

/** The committed schedule baseline — always available, even offline. */
function baselineMatches(): Match[] {
  return (fixturesSeed.matches as Match[]).map((m) => ({ ...m }));
}

function deriveWinner(m: Match): TeamId | null {
  if (m.homeScore === null || m.awayScore === null) return m.winner;
  if (m.home.kind !== "team" || m.away.kind !== "team") return m.winner;
  if (m.homeScore > m.awayScore) return m.home.team;
  if (m.awayScore > m.homeScore) return m.away.team;
  return m.winner; // a draw needs the feed/ESPN winner (shootout)
}

/**
 * Patch live scores from the fixturedownload feed onto the baseline by
 * MatchNumber. Returns the number of matches whose scores were filled in.
 */
function patchFromFeed(matches: Match[], feed: unknown): number {
  const rows = fixtureFeedSchema.parse(feed);
  const byNumber = new Map(matches.map((m) => [m.matchNumber, m]));
  let played = 0;
  for (const row of rows) {
    const m = byNumber.get(row.MatchNumber);
    if (!m) continue;
    if (row.HomeTeamScore !== null && row.AwayTeamScore !== null) {
      m.homeScore = row.HomeTeamScore;
      m.awayScore = row.AwayTeamScore;
      if (row.Winner) {
        const id = resolveTeam(row.Winner);
        if (id) m.winner = id;
      }
      m.winner = deriveWinner(m);
      played++;
    }
  }
  return played;
}

/** Patch ESPN results onto matches that are still missing scores. */
function patchFromEspn(
  matches: Match[],
  results: Array<{ home: TeamId; away: TeamId; homeScore: number; awayScore: number }>
): number {
  let patched = 0;
  for (const r of results) {
    const m = matches.find(
      (mm) =>
        mm.homeScore === null &&
        mm.home.kind === "team" &&
        mm.away.kind === "team" &&
        ((mm.home.team === r.home && mm.away.team === r.away) ||
          (mm.home.team === r.away && mm.away.team === r.home))
    );
    if (!m || m.home.kind !== "team" || m.away.kind !== "team") continue;
    // Orient the ESPN score to the scheduled home/away.
    if (m.home.team === r.home) {
      m.homeScore = r.homeScore;
      m.awayScore = r.awayScore;
    } else {
      m.homeScore = r.awayScore;
      m.awayScore = r.homeScore;
    }
    m.winner = deriveWinner(m);
    patched++;
  }
  return patched;
}

function datesToBackfill(matches: Match[]): string[] {
  const dates = new Set<string>();
  for (const m of matches) {
    if (m.homeScore === null && m.stage === "group") {
      dates.add(m.dateUtc.slice(0, 10).replace(/-/g, ""));
    }
  }
  return [...dates];
}

/**
 * Canonical match list: baseline schedule with the freshest available scores
 * merged on top. Tries the primary feed first, ESPN second; never hard-fails.
 */
export async function getMatchData(): Promise<MatchData> {
  const matches = baselineMatches();
  const fetchedAt = new Date().toISOString();

  // 1. Primary feed (requires browser UA; schema can drift → fail soft).
  try {
    const res = await fetch(FIXTURE_FEED_URL, {
      headers: { "User-Agent": BROWSER_UA },
      next: { revalidate: FIXTURES_REVALIDATE },
    });
    if (res.ok) {
      patchFromFeed(matches, await res.json());
      return { matches, source: "live", fetchedAt, stale: false };
    }
  } catch {
    // fall through to ESPN
  }

  // 2. ESPN fallback: patch scores for any past group-stage dates.
  try {
    const dates = datesToBackfill(matches).filter(
      (d) => d <= fetchedAt.slice(0, 10).replace(/-/g, "")
    );
    let patched = 0;
    for (const d of dates) {
      patched += patchFromEspn(matches, await fetchEspnResults(d));
    }
    if (patched > 0) {
      return { matches, source: "espn-fallback", fetchedAt, stale: false };
    }
  } catch {
    // fall through to baseline
  }

  // 3. Baseline only (offline): seed already carries whatever was captured.
  return { matches, source: "baseline", fetchedAt, stale: true };
}

export function playedMatches(matches: Match[]): Match[] {
  return matches.filter((m) => m.homeScore !== null && m.awayScore !== null);
}
