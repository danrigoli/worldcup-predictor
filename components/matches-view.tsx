"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchCard } from "@/components/match-card";
import { GroupTable } from "@/components/group-table";
import { ROUND_ORDER, roundOf } from "@/lib/rounds";
import type { Match, MatchProbabilities } from "@/lib/types";
import type { GroupStandings } from "@/lib/sim/groups";

export function MatchesView({
  matches,
  predictions,
  standings,
}: {
  matches: Match[];
  predictions: Record<number, MatchProbabilities>;
  standings: GroupStandings[];
}) {
  const byRound = new Map<string, Match[]>();
  for (const m of matches) {
    const key = roundOf(m.matchNumber).key;
    (byRound.get(key) ?? byRound.set(key, []).get(key)!).push(m);
  }

  const availableRounds = ROUND_ORDER.filter((k) => byRound.has(k));
  const firstUnfinished =
    availableRounds.find((k) =>
      byRound.get(k)!.some((m) => m.homeScore === null)
    ) ?? availableRounds[0];
  const [tab, setTab] = useState<string>(firstUnfinished);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="groups">Groups</TabsTrigger>
        {availableRounds.map((k) => (
          <TabsTrigger key={k} value={k}>
            {roundOf(byRound.get(k)![0].matchNumber).label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="groups" className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {standings.map((s) => (
            <GroupTable key={s.group} standings={s} />
          ))}
        </div>
      </TabsContent>

      {availableRounds.map((k) => (
        <TabsContent key={k} value={k} className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {byRound
              .get(k)!
              .sort((a, b) => a.matchNumber - b.matchNumber)
              .map((m) => (
                <MatchCard
                  key={m.matchNumber}
                  match={m}
                  prediction={predictions[m.matchNumber]}
                />
              ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
