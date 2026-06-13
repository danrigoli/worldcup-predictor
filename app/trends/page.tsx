import { LineChart, Info } from "lucide-react";
import { getPrediction } from "@/lib/engine";
import { snapshotStore } from "@/lib/data/snapshots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendsChart, type TrendPoint } from "@/components/trends-chart";
import type { TeamId } from "@/lib/types";

export const revalidate = 7200;

export default async function TrendsPage() {
  const [{ result }, snapshots] = await Promise.all([
    getPrediction(),
    snapshotStore.loadAll(),
  ]);

  // Top 6 teams by current title odds drive the legend.
  const topTeams = (Object.keys(result.odds) as TeamId[])
    .sort((a, b) => result.odds[b].winner - result.odds[a].winner)
    .slice(0, 6);

  const today = new Date().toISOString().slice(0, 10);
  const points: TrendPoint[] = snapshots
    .filter((s) => s.date !== today)
    .map((s) => ({
      date: s.date.slice(5),
      values: Object.fromEntries(
        topTeams.map((id) => [id, s.odds[id]?.winner ?? 0])
      ) as Record<TeamId, number>,
    }));

  // Append the live "now" point.
  points.push({
    date: "now",
    values: Object.fromEntries(
      topTeams.map((id) => [id, result.odds[id].winner])
    ) as Record<TeamId, number>,
  });

  const hasHistory = points.length >= 2;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="m-0 mb-1 font-display text-[34px] font-extrabold tracking-[-1px] text-ink">
          Odds over time
        </h1>
        <p className="m-0 text-sm text-[var(--muted)]">
          How each contender&apos;s title probability has evolved across daily
          snapshots.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <LineChart className="h-4 w-4" /> Championship odds by matchday
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasHistory ? (
            <TrendsChart points={points} teams={topTeams} />
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  Not enough history yet
                </p>
                <p>
                  Trends need at least two daily snapshots. A snapshot is saved
                  automatically each day (Vercel cron), or run{" "}
                  <code className="rounded bg-secondary px-1">pnpm snapshot</code>{" "}
                  after each matchday to capture one locally. The chart will draw
                  once a second snapshot exists.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
