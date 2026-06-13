import { K_FACTORS } from "@/lib/constants";
import { eloDelta, expectedScore } from "@/lib/model/elo";
import { lambdasFor } from "@/lib/model/goals";
import { ScoreSampler } from "@/lib/model/score-sampler";
import { netHomeAdvantage } from "@/lib/data/venues";
import { computeGroupStandings, type PlayedGroupMatch } from "@/lib/sim/groups";
import {
  allocateThirds,
  rankThirds,
  type ThirdPlaceTeam,
  type ThirdSlot,
} from "@/lib/sim/thirds";
import type {
  GroupLetter,
  HostCountry,
  Ratings,
  Slot,
  Stage,
  TeamId,
} from "@/lib/types";
import type { RNG } from "@/lib/rng";

/**
 * Sentinel team ids meaning "the home/away side of this match", used when a
 * knockout override locks an outcome before the participants are known.
 */
export const SIDE_HOME = "@HOME" as TeamId;
export const SIDE_AWAY = "@AWAY" as TeamId;

export interface GroupMatchDesc {
  matchNumber: number;
  group: GroupLetter;
  home: TeamId;
  away: TeamId;
  ha: number; // net Elo home advantage (home perspective)
  locked: { homeScore: number; awayScore: number } | null;
}

export interface KnockoutMatchDesc {
  matchNumber: number;
  stage: Exclude<Stage, "group">;
  home: Slot;
  away: Slot;
  hostCountry: HostCountry;
  locked: { winner: TeamId } | null;
}

export interface SimContext {
  baseRatings: Ratings;
  fifaRank: Ratings;
  groups: Record<GroupLetter, TeamId[]>;
  groupMatches: GroupMatchDesc[];
  knockoutMatches: KnockoutMatchDesc[];
  thirdSlots: ThirdSlot[];
}

export interface SimOutcome {
  /** Furthest stage reached per team, as boolean reach-flags. */
  reached: Map<TeamId, ReachFlags>;
  champion: TeamId;
}

export interface ReachFlags {
  r32: boolean;
  r16: boolean;
  qf: boolean;
  sf: boolean;
  final: boolean;
  winner: boolean;
}

function emptyFlags(): ReachFlags {
  return { r32: false, r16: false, qf: false, sf: false, final: false, winner: false };
}

/** Resolve the winner of a knockout match given both sides' current ratings. */
function knockoutWinner(
  home: TeamId,
  away: TeamId,
  ratingHome: number,
  ratingAway: number,
  ha: number,
  sampler: ScoreSampler,
  rng: RNG
): TeamId {
  const { lambdaHome, lambdaAway } = lambdasFor(ratingHome, ratingAway, ha);
  const { home: hg, away: ag } = sampler.sample(lambdaHome, lambdaAway, rng);
  if (hg > ag) return home;
  if (ag > hg) return away;
  // Drawn after 90'+ET → penalties as an Elo-weighted coin flip (no HA).
  const pHome = expectedScore(ratingHome - ratingAway);
  return rng() < pHome ? home : away;
}

/**
 * Simulate one complete tournament from the given context.
 * `ratings` is mutated locally (caller passes a fresh clone per sim).
 */
export function simulateOnce(
  ctx: SimContext,
  ratings: Ratings,
  sampler: ScoreSampler,
  rng: RNG
): SimOutcome {
  // ---- Group stage ----
  const perGroupResults = new Map<GroupLetter, PlayedGroupMatch[]>();
  for (const key of Object.keys(ctx.groups) as GroupLetter[]) {
    perGroupResults.set(key, []);
  }

  for (const gm of ctx.groupMatches) {
    let hs: number;
    let as: number;
    if (gm.locked) {
      hs = gm.locked.homeScore;
      as = gm.locked.awayScore;
    } else {
      const { lambdaHome, lambdaAway } = lambdasFor(
        ratings[gm.home],
        ratings[gm.away],
        gm.ha
      );
      const sampled = sampler.sample(lambdaHome, lambdaAway, rng);
      hs = sampled.home;
      as = sampled.away;
    }
    // Forward Elo update inside the sim (K=60).
    const delta = eloDelta(
      ratings[gm.home],
      ratings[gm.away],
      hs,
      as,
      K_FACTORS.worldCup,
      gm.ha
    );
    ratings[gm.home] += delta;
    ratings[gm.away] -= delta;
    perGroupResults
      .get(gm.group)!
      .push({ home: gm.home, away: gm.away, homeScore: hs, awayScore: as });
  }

  // ---- Standings, runners-up, thirds ----
  const rank1 = new Map<GroupLetter, TeamId>();
  const rank2 = new Map<GroupLetter, TeamId>();
  const thirds: ThirdPlaceTeam[] = [];
  for (const key of Object.keys(ctx.groups) as GroupLetter[]) {
    const standings = computeGroupStandings(
      key,
      ctx.groups[key],
      perGroupResults.get(key)!,
      ctx.fifaRank
    );
    rank1.set(key, standings.rows[0].team);
    rank2.set(key, standings.rows[1].team);
    thirds.push({
      team: standings.rows[2].team,
      group: key,
      standing: standings.rows[2],
    });
  }

  const rankedThirds = rankThirds(thirds, ctx.fifaRank);
  const qualifyingThirds = rankedThirds.slice(0, 8);
  const thirdAllocation =
    allocateThirds(qualifyingThirds, ctx.thirdSlots) ?? new Map<number, TeamId>();

  // ---- Knockouts ----
  const reached = new Map<TeamId, ReachFlags>();
  const flagsFor = (t: TeamId): ReachFlags => {
    let f = reached.get(t);
    if (!f) {
      f = emptyFlags();
      reached.set(t, f);
    }
    return f;
  };

  const winners = new Map<number, TeamId>();
  const losers = new Map<number, TeamId>();

  const resolve = (slot: Slot, matchNumber: number): TeamId => {
    switch (slot.kind) {
      case "team":
        return slot.team;
      case "group-rank":
        return (slot.rank === 1 ? rank1 : rank2).get(slot.group)!;
      case "third-pool":
        return thirdAllocation.get(matchNumber)!;
      case "match-winner":
        return winners.get(slot.matchNumber)!;
      case "match-loser":
        return losers.get(slot.matchNumber)!;
    }
  };

  let champion: TeamId = "";
  for (const km of ctx.knockoutMatches) {
    const home = resolve(km.home, km.matchNumber);
    const away = resolve(km.away, km.matchNumber);

    // Credit both participants for reaching this stage.
    for (const t of [home, away]) {
      const f = flagsFor(t);
      if (km.stage === "r32") f.r32 = true;
      else if (km.stage === "r16") f.r16 = true;
      else if (km.stage === "qf") f.qf = true;
      else if (km.stage === "sf") f.sf = true;
      else if (km.stage === "final") f.final = true;
      // third-place (103): participants already credited sf; nothing to add.
    }

    let winner: TeamId;
    if (km.locked) {
      // A knockout override locks the winning SIDE (teams unknown at build
      // time); an actual played result locks the concrete winning team.
      if (km.locked.winner === SIDE_HOME) winner = home;
      else if (km.locked.winner === SIDE_AWAY) winner = away;
      else winner = km.locked.winner;
    } else {
      const ha = netHomeAdvantage(km, home, away);
      winner = knockoutWinner(
        home,
        away,
        ratings[home],
        ratings[away],
        ha,
        sampler,
        rng
      );
    }
    const loser = winner === home ? away : home;
    winners.set(km.matchNumber, winner);
    losers.set(km.matchNumber, loser);

    if (km.stage === "final") {
      flagsFor(winner).winner = true;
      champion = winner;
    }
  }

  return { reached, champion };
}
