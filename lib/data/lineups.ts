import {
  LINEUP_PENALTY_CAP,
  LINEUP_SENSITIVITY,
  LINEUP_STAR_SHARE,
  LINEUP_WINDOW_HOURS,
} from "@/lib/constants";
import { fetchEspnDay, fetchEspnStarters } from "@/lib/data/espn";
import { normalizeName } from "@/lib/names";
import type {
  LineupByMatch,
  Match,
  MatchLineup,
  TeamId,
  TeamLineup,
} from "@/lib/types";

import seed from "@/data/seeds/player-values.json";

interface PV {
  xiValue: number;
  median: number;
  players: { name: string; n: string; s: string; v: number }[];
}
const TEAMS = (seed as { teams: Record<string, PV> }).teams;

const MAX_CANDIDATES = 8;

function utcStamp(ms: number): string {
  const d = new Date(ms);
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

function pairKey(a: TeamId, b: TeamId): string {
  return [a, b].sort().join("-");
}

/** Penalty + notable absentees for one team given its confirmed XI.
 *
 * Only KEY players (≥ LINEUP_STAR_SHARE of the best-XI value) absent from the
 * confirmed XI count. We test the presence of those few well-known names in the
 * starter list (robust), rather than valuing every starter — so ordinary
 * rotation and unrecognised squad players don't create phantom penalties.
 */
function teamPenalty(teamId: TeamId, starters: string[]): TeamLineup {
  const pv = TEAMS[teamId];
  // No squad data, or lineup not (fully) posted yet → no penalty.
  if (!pv || pv.xiValue <= 0 || !pv.players.length || starters.length < 11) {
    return { penalty: 0, missing: [] };
  }
  const starterNames = new Set(starters.map((s) => normalizeName(s)));
  const starterSurnames = new Set(
    starters.map((s) => normalizeName(s.split(" ").pop() ?? ""))
  );
  const present = (p: PV["players"][number]) =>
    starterNames.has(p.n) || starterSurnames.has(p.s);

  let absentShare = 0;
  const missing: string[] = [];
  for (const p of pv.players) {
    const share = p.v / pv.xiValue;
    if (share < LINEUP_STAR_SHARE) continue; // only key players matter
    if (!present(p)) {
      absentShare += share;
      missing.push(p.name);
    }
  }

  const penalty = Math.min(LINEUP_PENALTY_CAP, LINEUP_SENSITIVITY * absentShare);
  return { penalty: Math.round(penalty * 1000) / 1000, missing: missing.slice(0, 2) };
}

/**
 * Lineup-aware adjustments for matches that are live or kicking off soon, once
 * the confirmed XI is published. Returns {} when no lineups are available.
 * Never throws.
 */
export async function getLineupAdjustments(
  matches: Match[]
): Promise<LineupByMatch> {
  const out: LineupByMatch = {};
  try {
    const now = Date.now();
    const windowMs = LINEUP_WINDOW_HOURS * 3_600_000;
    const stamps = [utcStamp(now), utcStamp(now + 86_400_000)];
    const days = await Promise.all(stamps.map((s) => fetchEspnDay(s, 60)));
    const evByPair = new Map(days.flat().map((e) => [pairKey(e.home, e.away), e]));

    const candidates: { m: Match; id: string; start: number }[] = [];
    for (const m of matches) {
      if (m.home.kind !== "team" || m.away.kind !== "team") continue;
      if (m.homeScore !== null && m.awayScore !== null) continue;
      const ev = evByPair.get(pairKey(m.home.team, m.away.team));
      if (!ev || !ev.id) continue;
      const start = new Date(ev.startUtc).getTime();
      const soon = ev.state === "pre" && start - now <= windowMs && start - now > -6 * 3_600_000;
      if (ev.state === "in" || soon) candidates.push({ m, id: ev.id, start });
    }
    candidates.sort((a, b) => a.start - b.start);

    const top = candidates.slice(0, MAX_CANDIDATES);
    const starterSets = await Promise.all(top.map((c) => fetchEspnStarters(c.id)));
    top.forEach((c, i) => {
      const s = starterSets[i];
      const home = c.m.home.kind === "team" ? teamPenalty(c.m.home.team, s[c.m.home.team] ?? []) : { penalty: 0, missing: [] };
      const away = c.m.away.kind === "team" ? teamPenalty(c.m.away.team, s[c.m.away.team] ?? []) : { penalty: 0, missing: [] };
      if (home.penalty > 0 || away.penalty > 0 || home.missing.length || away.missing.length) {
        out[c.m.matchNumber] = { home, away } as MatchLineup;
      }
    });
  } catch {
    return out;
  }
  return out;
}
