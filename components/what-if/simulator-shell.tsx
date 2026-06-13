"use client";

import { RotateCcw, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchOverrideRow } from "@/components/what-if/match-override-row";
import { OddsDeltaPanel } from "@/components/what-if/odds-delta-panel";
import { useOverrideStore } from "@/components/what-if/override-store";
import { useSimWorker } from "@/components/what-if/use-sim-worker";
import { roundOf } from "@/lib/rounds";
import type { Match, OddsByTeam, Ratings } from "@/lib/types";

export function SimulatorShell({
  matches,
  preRatings,
  fifaRank,
  baselineOdds,
  simCount,
  seed,
}: {
  matches: Match[];
  preRatings: Ratings;
  fifaRank: Ratings;
  baselineOdds: OddsByTeam;
  simCount: number;
  seed: number;
}) {
  const overrides = useOverrideStore((s) => s.overrides);
  const clearAll = useOverrideStore((s) => s.clearAll);
  const activeCount = Object.keys(overrides).length;

  const { odds, running } = useSimWorker({
    matches,
    preRatings,
    fifaRank,
    baselineOdds,
    overrides,
    simCount,
    seed,
  });

  // Editable matches = those with two concrete teams (group games + any
  // already-played knockouts). Grouped by matchday.
  const editable = matches.filter(
    (m) => m.home.kind === "team" && m.away.kind === "team"
  );
  const matchdays = ["md1", "md2", "md3"] as const;
  const byMd = (key: string) =>
    editable
      .filter((m) => roundOf(m.matchNumber).key === key)
      .sort((a, b) => a.matchNumber - b.matchNumber);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Force results</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={activeCount === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset all ({activeCount})
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="md1">
            <TabsList>
              {matchdays.map((md) => (
                <TabsTrigger key={md} value={md}>
                  Matchday {md.slice(2)}
                </TabsTrigger>
              ))}
            </TabsList>
            {matchdays.map((md) => (
              <TabsContent key={md} value={md} className="mt-3 space-y-1.5">
                {byMd(md).map((m) => (
                  <MatchOverrideRow key={m.matchNumber} match={m} />
                ))}
              </TabsContent>
            ))}
          </Tabs>
          <p className="mt-3 text-xs text-muted-foreground">
            Adjust any group result with the steppers. Knockout games become
            editable once the bracket fills in.
          </p>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            Title odds {activeCount > 0 ? "(what-if)" : "(baseline)"}
          </CardTitle>
          {running && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <OddsDeltaPanel
            baseline={baselineOdds}
            whatIf={odds}
            running={running}
          />
        </CardContent>
      </Card>
    </div>
  );
}
