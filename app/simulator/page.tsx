import { getPrediction } from "@/lib/engine";
import { SimulatorShell } from "@/components/what-if/simulator-shell";

export const revalidate = 15;

export default async function SimulatorPage() {
  const { matchData, preRatings, fifaRank, result } = await getPrediction();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="m-0 mb-1 font-display text-[34px] font-extrabold tracking-[-1px] text-ink">
          What-if Simulator
        </h1>
        <p className="m-0 text-sm text-[var(--muted)]">
          Force any result and re-run all 10,000 simulations to watch the title
          race shift instantly.
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
