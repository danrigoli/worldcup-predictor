import { oneXTwo, scoreGrid } from "@/lib/model/dixon-coles";
import { ScoreSampler } from "@/lib/model/score-sampler";
import { computeGroupStandings, type PlayedGroupMatch } from "@/lib/sim/groups";
import type { MatchModel } from "@/lib/sim/match-model";
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
  hostCountry: HostCountry;
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
  matchModel: MatchModel;
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

/** Resolve a knockout winner from the match's expected goals. */
function knockoutWinner(
  home: TeamId,
  away: TeamId,
  lambdaHome: number,
  lambdaAway: number,
  sampler: ScoreSampler,
  rng: RNG
): TeamId {
  const { home: hg, away: ag } = sampler.sample(lambdaHome, lambdaAway, rng);
  if (hg > ag) return home;
  if (ag > hg) return away;
  // Drawn after 90'+ET → penalties as a strength-weighted coin flip, using the
  // model's win probabilities conditioned on a decisive result.
  const { home: pH, away: pA } = oneXTwo(scoreGrid(lambdaHome, lambdaAway));
  const pHome = pH + pA > 0 ? pH / (pH + pA) : 0.5;
  return rng() < pHome ? home : away;
}

/** Simulate one complete tournament from the given context. */
export function simulateOnce(
  ctx: SimContext,
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
      const { lambdaHome, lambdaAway } = ctx.matchModel.lambdas(
        gm.home,
        gm.away,
        gm.hostCountry
      );
      const sampled = sampler.sample(lambdaHome, lambdaAway, rng);
      hs = sampled.home;
      as = sampled.away;
    }
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
  const thirdAllocation = allocateThirds(qualifyingThirds, ctx.thirdSlots);
  if (!thirdAllocation) {
    // Every C(12,8) subset of qualifying groups has a valid bijective matching
    // against the real feed pools, so this is unreachable in production — but
    // fail loudly rather than silently corrupting a simulation if it ever isn't.
    throw new Error("No valid best-thirds allocation for the qualifying groups");
  }

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
    if (km.locked && km.locked.winner === SIDE_HOME) {
      winner = home; // override locking the home side
    } else if (km.locked && km.locked.winner === SIDE_AWAY) {
      winner = away; // override locking the away side
    } else if (
      km.locked &&
      (km.locked.winner === home || km.locked.winner === away)
    ) {
      winner = km.locked.winner; // played result, winner is a resolved participant
    } else {
      // Either not locked, or a locked concrete winner that doesn't match either
      // resolved participant (data inconsistency) — simulate the match instead.
      const { lambdaHome, lambdaAway } = ctx.matchModel.lambdas(
        home,
        away,
        km.hostCountry
      );
      winner = knockoutWinner(home, away, lambdaHome, lambdaAway, sampler, rng);
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
