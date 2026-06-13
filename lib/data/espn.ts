import { BROWSER_UA, ESPN_SCOREBOARD_URL } from "@/lib/constants";
import { resolveTeam } from "@/lib/names";
import { espnScoreboardSchema } from "@/lib/data/schemas";
import type { TeamId } from "@/lib/types";

export interface EspnResult {
  home: TeamId;
  away: TeamId;
  homeScore: number;
  awayScore: number;
}

/**
 * Fetch completed match results for one UTC day from the unofficial ESPN
 * scoreboard API. Used only as a fallback to patch scores when the primary
 * feed is stale/unavailable. Returns [] on any error (never throws).
 */
export async function fetchEspnResults(yyyymmdd: string): Promise<EspnResult[]> {
  try {
    const res = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${yyyymmdd}`, {
      headers: { "User-Agent": BROWSER_UA },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const parsed = espnScoreboardSchema.safeParse(await res.json());
    if (!parsed.success) return [];

    const out: EspnResult[] = [];
    for (const event of parsed.data.events) {
      if (!event.status.type.completed) continue;
      const comp = event.competitions[0];
      if (!comp) continue;
      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;
      const homeId = resolveTeam(home.team.displayName);
      const awayId = resolveTeam(away.team.displayName);
      // Reject missing/blank scores explicitly — Number("") coerces to 0.
      if (
        home.score === undefined ||
        away.score === undefined ||
        home.score.trim() === "" ||
        away.score.trim() === ""
      ) {
        continue;
      }
      const hs = Number(home.score);
      const as = Number(away.score);
      if (!homeId || !awayId || !Number.isFinite(hs) || !Number.isFinite(as)) {
        continue;
      }
      out.push({ home: homeId, away: awayId, homeScore: hs, awayScore: as });
    }
    return out;
  } catch {
    return [];
  }
}
