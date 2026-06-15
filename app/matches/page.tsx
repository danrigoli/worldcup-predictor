import { getPrediction } from "@/lib/engine";
import { predictMatch } from "@/lib/sim/match-predictions";
import { liveGroupStandings } from "@/lib/standings";
import { getLiveMatches } from "@/lib/data/live";
import { getLineupAdjustments } from "@/lib/data/lineups";
import { MatchesView } from "@/components/matches-view";
import type { MatchProbabilities } from "@/lib/types";

// Short revalidate so live status/scores refresh ~each minute. The heavy sim is
// cached separately inside getPrediction, so this stays cheap.
export const revalidate = 15;

export default async function MatchesPage() {
  const { matchData, effective, fifaRank } = await getPrediction();
  const [live, lineups] = await Promise.all([
    getLiveMatches(matchData.matches),
    getLineupAdjustments(matchData.matches),
  ]);

  // Predict every match whose teams are known — including played ones, so the
  // model's pre-match call can be compared against the actual result. Upcoming
  // matches with a confirmed XI get the lineup-strength penalty applied.
  const predictions: Record<number, MatchProbabilities> = {};
  for (const m of matchData.matches) {
    if (m.home.kind === "team" && m.away.kind === "team") {
      const lineup = m.homeScore === null ? lineups[m.matchNumber] : undefined;
      predictions[m.matchNumber] = predictMatch(
        effective,
        m.home.team,
        m.away.team,
        m.hostCountry,
        5,
        lineup
          ? { home: lineup.home.penalty, away: lineup.away.penalty }
          : undefined
      );
    }
  }

  const standings = liveGroupStandings(matchData.matches, fifaRank);

  return (
    <MatchesView
      matches={matchData.matches}
      predictions={predictions}
      standings={standings}
      live={live}
      lineups={lineups}
    />
  );
}
