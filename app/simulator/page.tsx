import { getPrediction } from "@/lib/engine";
import { SimulatorShell } from "@/components/what-if/simulator-shell";

export const revalidate = 7200;

export default async function SimulatorPage() {
  const { matchData, preRatings, fifaRank, result } = await getPrediction();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">What-if Simulator</h1>
        <p className="text-sm text-muted-foreground">
          Force any result and the whole tournament re-simulates instantly. The
          right panel shows how each team&apos;s title odds shift from the
          baseline.
        </p>
      </div>
      <SimulatorShell
        matches={matchData.matches}
        preRatings={preRatings}
        fifaRank={fifaRank}
        baselineOdds={result.odds}
        simCount={result.simCount}
        seed={result.seed}
      />
    </div>
  );
}
