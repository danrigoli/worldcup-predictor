import { BROWSER_UA, ESPN_SCOREBOARD_URL } from "@/lib/constants";
import { resolveTeam } from "@/lib/names";
import { espnScoreboardSchema } from "@/lib/data/schemas";
import type { MatchStats, TeamId } from "@/lib/types";

export interface EspnResult {
  home: TeamId;
  away: TeamId;
  homeScore: number;
  awayScore: number;
}

export interface EspnDayMatch {
  home: TeamId;
  away: TeamId;
  homeScore: number | null;
  awayScore: number | null;
  state: "pre" | "in" | "post";
  detail: string; // "FT", "HT", "62'"
  clock: string | null;
  completed: boolean;
  stats: { home: MatchStats; away: MatchStats } | null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseStats(stats?: { name: string; displayValue?: unknown }[]): MatchStats {
  const by = new Map<string, unknown>();
  for (const s of stats ?? []) by.set(s.name, s.displayValue);
  return {
    possession: num(by.get("possessionPct")),
    shots: num(by.get("totalShots")),
    shotsOnTarget: num(by.get("shotsOnTarget")),
    corners: num(by.get("wonCorners")),
    fouls: num(by.get("foulsCommitted")),
  };
}

function hasAnyStat(s: MatchStats): boolean {
  return (
    s.possession !== null ||
    s.shots !== null ||
    s.shotsOnTarget !== null ||
    s.corners !== null ||
    s.fouls !== null
  );
}

/**
 * Fetch all matches for one UTC day from the unofficial ESPN scoreboard API,
 * including live status and per-team statistics. Returns [] on any error.
 */
export async function fetchEspnDay(
  yyyymmdd: string,
  revalidate = 1800
): Promise<EspnDayMatch[]> {
  try {
    const res = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${yyyymmdd}`, {
      headers: { "User-Agent": BROWSER_UA },
      next: { revalidate },
    });
    if (!res.ok) return [];
    const parsed = espnScoreboardSchema.safeParse(await res.json());
    if (!parsed.success) return [];

    const out: EspnDayMatch[] = [];
    for (const event of parsed.data.events) {
      const comp = event.competitions[0];
      if (!comp) continue;
      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;
      const homeId = resolveTeam(home.team.displayName);
      const awayId = resolveTeam(away.team.displayName);
      if (!homeId || !awayId) continue;

      const t = event.status.type;
      const state: EspnDayMatch["state"] =
        t.state === "in" ? "in" : t.state === "post" ? "post" : "pre";
      const homeStats = parseStats(home.statistics);
      const awayStats = parseStats(away.statistics);
      const hasStats = hasAnyStat(homeStats) || hasAnyStat(awayStats);

      out.push({
        home: homeId,
        away: awayId,
        homeScore: home.score && home.score.trim() !== "" ? num(home.score) : null,
        awayScore: away.score && away.score.trim() !== "" ? num(away.score) : null,
        state,
        detail: t.shortDetail ?? t.detail ?? "",
        clock: state === "in" ? event.status.displayClock ?? null : null,
        completed: t.completed,
        stats: hasStats ? { home: homeStats, away: awayStats } : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Completed results for one UTC day — used as the score fallback when the
 * primary feed is stale/unavailable.
 */
export async function fetchEspnResults(yyyymmdd: string): Promise<EspnResult[]> {
  const day = await fetchEspnDay(yyyymmdd);
  const out: EspnResult[] = [];
  for (const m of day) {
    if (m.completed && m.homeScore !== null && m.awayScore !== null) {
      out.push({
        home: m.home,
        away: m.away,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      });
    }
  }
  return out;
}
