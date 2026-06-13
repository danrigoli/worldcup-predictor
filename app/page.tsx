import { getPrediction } from "@/lib/engine";
import { playedMatches } from "@/lib/data/fixtures";
import { TEAM_BY_ID } from "@/lib/names";
import { DashboardView, type DashTeam } from "@/components/dashboard/dashboard-view";
import type { TeamId } from "@/lib/types";

export const revalidate = 7200;

const SOURCE_LABEL: Record<string, string> = {
  live: "Live feed",
  "espn-fallback": "ESPN fallback",
  baseline: "Cached schedule",
};

export default async function DashboardPage() {
  const { matchData, result } = await getPrediction();
  const played = playedMatches(matchData.matches).length;

  const teams: DashTeam[] = (Object.keys(result.odds) as TeamId[]).map((id) => ({
    id,
    name: TEAM_BY_ID[id].name,
    flag: TEAM_BY_ID[id].flag,
    group: TEAM_BY_ID[id].group,
    odds: result.odds[id],
  }));

  return (
    <DashboardView
      teams={teams}
      simCount={result.simCount}
      played={played}
      source={SOURCE_LABEL[matchData.source] ?? matchData.source}
      stale={matchData.stale}
    />
  );
}
