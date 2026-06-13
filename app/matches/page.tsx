import { getPrediction } from "@/lib/engine";
import { predictMatch } from "@/lib/sim/match-predictions";
import { liveGroupStandings } from "@/lib/standings";
import { MatchesView } from "@/components/matches-view";
import type { MatchProbabilities } from "@/lib/types";

export const revalidate = 7200;

export default async function MatchesPage() {
  const { matchData, effective, fifaRank } = await getPrediction();

  // Predict every upcoming match whose teams are already known.
  const predictions: Record<number, MatchProbabilities> = {};
  for (const m of matchData.matches) {
    if (
      m.homeScore === null &&
      m.home.kind === "team" &&
      m.away.kind === "team"
    ) {
      predictions[m.matchNumber] = predictMatch(
        effective,
        m.home.team,
        m.away.team,
        m.hostCountry
      );
    }
  }

  const standings = liveGroupStandings(matchData.matches, fifaRank);

  return (
    <MatchesView
      matches={matchData.matches}
      predictions={predictions}
      standings={standings}
    />
  );
}
