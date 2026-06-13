import { Brain, Cpu, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamLabel } from "@/components/team-label";
import { modelMeta, teamRatings } from "@/lib/data/ml-artifacts";
import { ALL_TEAM_IDS } from "@/lib/names";
import { formatPct } from "@/lib/utils";
import type { TeamId } from "@/lib/types";

export const metadata = { title: "Model — WC 2026 Predictor" };

export default function ModelPage() {
  const bt = modelMeta.backtest;
  const cal = modelMeta.calibration;

  const ranked = ALL_TEAM_IDS.map((id) => ({ id, ...teamRatings[id] })).sort(
    (a, b) => b.title_prob - a.title_prob
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="m-0 mb-1 font-display text-[34px] font-extrabold tracking-[-1px] text-ink">
          The model
        </h1>
        <p className="text-sm text-muted-foreground">
          A LightGBM Poisson goals model (Python) trained on ~49,000
          internationals since 1872 plus historical squad market values. It
          predicts expected goals for every matchup; the TypeScript engine
          simulates the bracket {cal.sim_count?.toLocaleString() ?? "10,000"}{" "}
          times.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Brain className="h-4 w-4" /> Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">LightGBM · Poisson</div>
            <p className="text-sm text-muted-foreground">
              {modelMeta.features.length} features · Elo, market value, form,
              rest, host
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Backtest (RPS)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bt && bt.gbm_rps != null ? (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {bt.gbm_rps.toFixed(4)}
                </div>
                <p className="text-sm text-muted-foreground">
                  vs Elo+Dixon-Coles {bt.baseline_rps?.toFixed(4)} ·{" "}
                  <span className={bt.beats_baseline ? "text-win" : "text-loss"}>
                    {bt.beats_baseline ? "beats baseline" : "below baseline"}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Run <code>pnpm ml:backtest</code>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Target className="h-4 w-4" /> Calibration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              T = {cal.temperature?.toFixed(3) ?? "—"}
            </div>
            <p className="text-sm text-muted-foreground">
              favourite {cal.favorite_title_prob != null ? formatPct(cal.favorite_title_prob) : "—"}{" "}
              (target {cal.target != null ? formatPct(cal.target) : "—"})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> Trained through
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{modelMeta.training_cutoff}</div>
            <p className="text-sm text-muted-foreground">
              from {modelMeta.training_start} · {modelMeta.half_life_days}d
              half-life
            </p>
          </CardContent>
        </Card>
      </div>

      {bt && bt.per_tournament?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Out-of-sample backtest by tournament</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Ranked Probability Score (lower is better) on each tournament,
              training only on matches before it. The ML model is compared to the
              Elo + Dixon-Coles closed-form baseline.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5">Tournament</th>
                  <th className="py-1.5 text-right">Matches</th>
                  <th className="py-1.5 text-right">ML RPS</th>
                  <th className="py-1.5 text-right">Baseline</th>
                  <th className="py-1.5 text-right">Winner</th>
                </tr>
              </thead>
              <tbody>
                {bt.per_tournament.map((r) => (
                  <tr key={r.tournament} className="border-b border-border/50">
                    <td className="py-1.5 font-medium">{r.tournament}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.matches}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {r.gbm_rps.toFixed(4)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {r.baseline_rps.toFixed(4)}
                    </td>
                    <td className="py-1.5 text-right">
                      <span
                        className={
                          r.gbm_rps < r.baseline_rps ? "text-win" : "text-muted-foreground"
                        }
                      >
                        {r.gbm_rps < r.baseline_rps ? "ML" : "baseline"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Learned team ratings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Attack and defense are goals scored / prevented vs the field average
            (1.0 = average; higher is better for both). Strength blends Elo, FIFA
            rank and coach record; market value is the summed top-26 squad value.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5">Team</th>
                  <th className="py-1.5 text-right">Title %</th>
                  <th className="py-1.5 text-right">Attack</th>
                  <th className="py-1.5 text-right">Defense</th>
                  <th className="py-1.5 text-right">Elo</th>
                  <th className="py-1.5 text-right">Squad €m</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-1.5">
                      <TeamLabel id={t.id as TeamId} />
                    </td>
                    <td className="py-1.5 text-right font-medium tabular-nums">
                      {formatPct(t.title_prob)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {t.attack.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {t.defense.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {t.elo != null ? Math.round(t.elo) : "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {t.market_value_m != null
                        ? t.market_value_m.toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
