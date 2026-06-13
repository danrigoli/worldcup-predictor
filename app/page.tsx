import { Trophy, CheckCircle2, Database, AlertTriangle } from "lucide-react";
import { getPrediction } from "@/lib/engine";
import { playedMatches } from "@/lib/data/fixtures";
import { TEAM_BY_ID } from "@/lib/names";
import { formatPct } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TitleOddsChart } from "@/components/title-odds-chart";
import { OddsTable } from "@/components/odds-table";
import { TeamLabel } from "@/components/team-label";
import type { TeamId } from "@/lib/types";

export const revalidate = 7200;

const SOURCE_LABEL: Record<string, string> = {
  live: "Live feed (fixturedownload)",
  "espn-fallback": "ESPN fallback",
  baseline: "Cached schedule (offline)",
};

export default async function DashboardPage() {
  const { matchData, result } = await getPrediction();
  const played = playedMatches(matchData.matches);

  const ranked = (Object.keys(result.odds) as TeamId[])
    .map((id) => ({ id, ...result.odds[id] }))
    .sort((a, b) => b.winner - a.winner);
  const favorite = ranked[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Championship Odds</h1>
          <p className="text-sm text-muted-foreground">
            {result.simCount.toLocaleString()} Monte Carlo simulations · LightGBM
            goals model trained on 49k internationals + squad market values
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" /> Favourite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <TeamLabel id={favorite.id} />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatPct(favorite.winner)} to win the cup
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Matches played
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {played.length}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / 104
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Predictions update as results arrive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Data source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {matchData.stale && (
                <AlertTriangle className="h-4 w-4 text-loss" />
              )}
              {SOURCE_LABEL[matchData.source] ?? matchData.source}
            </div>
            <p className="text-sm text-muted-foreground">
              Updated {new Date(matchData.fetchedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Title odds — top 12</CardTitle>
          </CardHeader>
          <CardContent>
            <TitleOddsChart odds={result.odds} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to read this</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              A machine-learning goals model (LightGBM, Poisson) predicts the
              expected goals for any matchup from team strength (150-year Elo +
              FIFA rank), historical squad market values, recent form, rest and
              host advantage — it beats a strong Elo baseline out-of-sample.
            </p>
            <p>
              The full tournament — all 104 matches, the 12 groups, the
              best-third allocation and the knockout bracket — is simulated{" "}
              {result.simCount.toLocaleString()} times. Played results are locked
              in and the favourites re-computed each time the data refreshes.
            </p>
            <p>
              See the <strong>Model</strong> tab for the backtest and learned
              ratings, the <strong>Simulator</strong> to force any result, or{" "}
              <strong>Matches</strong> for per-game predictions.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All 48 teams</CardTitle>
        </CardHeader>
        <CardContent>
          <OddsTable odds={result.odds} />
        </CardContent>
      </Card>
    </div>
  );
}
