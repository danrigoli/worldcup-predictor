"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TEAM_BY_ID } from "@/lib/names";
import { cn, formatPct } from "@/lib/utils";
import { TeamLabel } from "@/components/team-label";
import type { OddsByTeam, StageOdds, TeamId } from "@/lib/types";

type Column = { key: keyof StageOdds; label: string };

const COLUMNS: Column[] = [
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16" },
  { key: "qf", label: "QF" },
  { key: "sf", label: "SF" },
  { key: "final", label: "Final" },
  { key: "winner", label: "Champion" },
];

export function OddsTable({ odds }: { odds: OddsByTeam }) {
  const [sortKey, setSortKey] = useState<keyof StageOdds>("winner");
  const [desc, setDesc] = useState(true);

  const rows = (Object.keys(odds) as TeamId[])
    .map((id) => ({ id, ...odds[id] }))
    .sort((a, b) => {
      const d = b[sortKey] - a[sortKey];
      return desc ? d : -d;
    });

  const toggle = (key: keyof StageOdds) => {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-secondary/50 text-left">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">Group</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 text-right font-medium">
                <button
                  onClick={() => toggle(c.key)}
                  className={cn(
                    "inline-flex items-center gap-0.5 hover:text-foreground",
                    sortKey === c.key ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {c.label}
                  {sortKey === c.key &&
                    (desc ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronUp className="h-3 w-3" />
                    ))}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/30">
              <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                {i + 1}
              </td>
              <td className="px-3 py-1.5">
                <TeamLabel id={r.id} />
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {TEAM_BY_ID[r.id]?.group}
              </td>
              {COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-2 py-1.5 text-right tabular-nums",
                    c.key === sortKey ? "font-medium" : "text-muted-foreground",
                    c.key === "winner" && "text-foreground"
                  )}
                >
                  {formatPct(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
