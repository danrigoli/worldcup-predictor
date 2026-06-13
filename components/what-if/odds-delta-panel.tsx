"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { TeamLabel } from "@/components/team-label";
import { cn, formatPct } from "@/lib/utils";
import type { OddsByTeam, TeamId } from "@/lib/types";

export function OddsDeltaPanel({
  baseline,
  whatIf,
  running,
}: {
  baseline: OddsByTeam;
  whatIf: OddsByTeam;
  running: boolean;
}) {
  const rows = (Object.keys(whatIf) as TeamId[])
    .map((id) => ({
      id,
      now: whatIf[id].winner,
      delta: whatIf[id].winner - baseline[id].winner,
    }))
    .sort((a, b) => b.now - a.now)
    .slice(0, 16);

  return (
    <div className={cn("space-y-1", running && "opacity-60")}>
      <div className="flex justify-between px-1 text-xs text-muted-foreground">
        <span>Team</span>
        <span>Champion {running ? "(updating…)" : ""}</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between rounded px-1 py-1 text-sm hover:bg-secondary/40"
        >
          <TeamLabel id={r.id} />
          <div className="flex items-center gap-2 tabular-nums">
            <span className="font-medium">{formatPct(r.now)}</span>
            <DeltaBadge delta={r.delta} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.001) {
    return <span className="w-16 text-right text-xs text-muted-foreground">—</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "flex w-16 items-center justify-end gap-0.5 text-xs",
        up ? "text-win" : "text-loss"
      )}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {formatPct(Math.abs(delta))}
    </span>
  );
}
