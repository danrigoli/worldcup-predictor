import { GROUPS } from "@/lib/names";
import {
  computeGroupStandings,
  type GroupStandings,
  type PlayedGroupMatch,
} from "@/lib/sim/groups";
import type { GroupLetter, Match, Ratings } from "@/lib/types";

/** Played group matches, grouped by group letter, as PlayedGroupMatch. */
export function playedGroupMatchesByGroup(
  matches: Match[]
): Record<GroupLetter, PlayedGroupMatch[]> {
  const out = {} as Record<GroupLetter, PlayedGroupMatch[]>;
  for (const letter of Object.keys(GROUPS) as GroupLetter[]) out[letter] = [];
  for (const m of matches) {
    if (
      m.stage !== "group" ||
      m.group === null ||
      m.homeScore === null ||
      m.awayScore === null ||
      m.home.kind !== "team" ||
      m.away.kind !== "team"
    ) {
      continue;
    }
    out[m.group].push({
      home: m.home.team,
      away: m.away.team,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
    });
  }
  return out;
}

/** Current standings for every group given results so far. */
export function liveGroupStandings(
  matches: Match[],
  fifaRank: Ratings
): GroupStandings[] {
  const played = playedGroupMatchesByGroup(matches);
  return (Object.keys(GROUPS) as GroupLetter[]).map((letter) =>
    computeGroupStandings(letter, GROUPS[letter], played[letter], fifaRank)
  );
}
