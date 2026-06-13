import { formatPct } from "@/lib/utils";
import type { MatchProbabilities } from "@/lib/types";

export function ScorelineList({
  scorelines,
}: {
  scorelines: MatchProbabilities["topScorelines"];
}) {
  return (
    <ul className="space-y-1 text-xs">
      {scorelines.map((s, i) => (
        <li key={i} className="flex justify-between text-muted-foreground">
          <span className="tabular-nums text-foreground">
            {s.home}–{s.away}
          </span>
          <span className="tabular-nums">{formatPct(s.p)}</span>
        </li>
      ))}
    </ul>
  );
}
