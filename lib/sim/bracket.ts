import { netHomeAdvantage } from "@/lib/data/venues";
import { GROUPS } from "@/lib/names";
import type {
  GroupLetter,
  Match,
  Overrides,
  Ratings,
  TeamId,
} from "@/lib/types";
import {
  SIDE_AWAY,
  SIDE_HOME,
  type GroupMatchDesc,
  type KnockoutMatchDesc,
  type SimContext,
} from "@/lib/sim/tournament";
import type { ThirdSlot } from "@/lib/sim/thirds";

function winnerSideFromScore(
  homeScore: number,
  awayScore: number,
  winnerOnPens?: "home" | "away"
): "home" | "away" {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return winnerOnPens ?? "home";
}

/**
 * Compile the schedule + ratings + what-if overrides into the immutable
 * SimContext consumed by simulateOnce. Played results and overrides become
 * "locked" outcomes; everything else is simulated.
 */
export function buildSimContext(
  matches: Match[],
  ratings: Ratings,
  fifaRank: Ratings,
  overrides: Overrides = {}
): SimContext {
  const groupMatches: GroupMatchDesc[] = [];
  const knockoutMatches: KnockoutMatchDesc[] = [];
  const thirdSlots: ThirdSlot[] = [];

  for (const m of matches) {
    const override = overrides[m.matchNumber];

    if (m.stage === "group") {
      if (m.home.kind !== "team" || m.away.kind !== "team") continue;
      const home = m.home.team;
      const away = m.away.team;
      let locked: GroupMatchDesc["locked"] = null;
      if (override) {
        locked = { homeScore: override.homeScore, awayScore: override.awayScore };
      } else if (m.homeScore !== null && m.awayScore !== null) {
        locked = { homeScore: m.homeScore, awayScore: m.awayScore };
      }
      groupMatches.push({
        matchNumber: m.matchNumber,
        group: m.group as GroupLetter,
        home,
        away,
        ha: netHomeAdvantage(m, home, away),
        locked,
      });
      continue;
    }

    // Knockout match
    for (const side of [m.home, m.away]) {
      if (side.kind === "third-pool") {
        thirdSlots.push({ matchNumber: m.matchNumber, pool: side.groups });
      }
    }

    let locked: KnockoutMatchDesc["locked"] = null;
    if (override) {
      const side = winnerSideFromScore(
        override.homeScore,
        override.awayScore,
        override.winnerOnPens
      );
      // Teams unknown until the bracket resolves → resolve side at sim time.
      locked = { winner: side === "home" ? SIDE_HOME : SIDE_AWAY };
    } else if (m.winner) {
      locked = { winner: m.winner };
    }

    knockoutMatches.push({
      matchNumber: m.matchNumber,
      stage: m.stage,
      home: m.home,
      away: m.away,
      hostCountry: m.hostCountry,
      locked,
    });
  }

  groupMatches.sort((a, b) => a.matchNumber - b.matchNumber);
  knockoutMatches.sort((a, b) => a.matchNumber - b.matchNumber);

  return {
    baseRatings: ratings,
    fifaRank,
    groups: GROUPS as Record<GroupLetter, TeamId[]>,
    groupMatches,
    knockoutMatches,
    thirdSlots,
  };
}
