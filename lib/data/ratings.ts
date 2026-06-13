import { HOME_ADVANTAGE, K_FACTORS } from "@/lib/constants";
import { eloDelta } from "@/lib/model/elo";
import { blendRatings } from "@/lib/model/blend";
import { netHomeAdvantage } from "@/lib/data/venues";
import { ALL_TEAM_IDS } from "@/lib/names";
import type { Match, Ratings } from "@/lib/types";

import ratingsSeed from "@/data/derived/ratings.json";
import fifaSeed from "@/data/seeds/fifa-rankings.json";
import squadSeed from "@/data/seeds/squad-values.json";

/**
 * Pre-tournament blended strength ratings for the 48 teams.
 * Computed once from the committed seeds (Elo + FIFA + squad value).
 */
export function blendedPreTournamentRatings(): Ratings {
  return blendRatings(
    ALL_TEAM_IDS,
    ratingsSeed.ratings as Ratings,
    fifaSeed.points as Ratings,
    squadSeed.valuesEur as Partial<Ratings>
  );
}

/**
 * Effective ratings = pre-tournament blend, then Elo updated forward (K=60)
 * for every played group/knockout match in chronological order. This is the
 * "Bayesian re-fitting" that lets the sim condition on real results.
 */
export function effectiveRatings(playedMatches: Match[]): Ratings {
  const ratings = blendedPreTournamentRatings();
  const sorted = [...playedMatches].sort((a, b) =>
    a.dateUtc < b.dateUtc ? -1 : a.dateUtc > b.dateUtc ? 1 : a.matchNumber - b.matchNumber
  );
  for (const m of sorted) {
    if (
      m.homeScore === null ||
      m.awayScore === null ||
      m.home.kind !== "team" ||
      m.away.kind !== "team"
    ) {
      continue;
    }
    const ha = netHomeAdvantage(m, m.home.team, m.away.team);
    const delta = eloDelta(
      ratings[m.home.team],
      ratings[m.away.team],
      m.homeScore,
      m.awayScore,
      K_FACTORS.worldCup,
      ha
    );
    ratings[m.home.team] += delta;
    ratings[m.away.team] -= delta;
  }
  return ratings;
}

export const PRETOURNAMENT_HOME_ADVANTAGE = HOME_ADVANTAGE;
