import { cn } from "@/lib/utils";
import { TeamLabel } from "@/components/team-label";
import type { GroupStandings } from "@/lib/sim/groups";

/** Live group standings table with current 2026 tiebreakers applied. */
export function GroupTable({ standings }: { standings: GroupStandings }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-secondary/50 px-3 py-1.5 text-sm font-semibold">
        Group {standings.group}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="px-3 py-1 text-left font-medium">Team</th>
            <th className="px-1.5 py-1 text-right font-medium">P</th>
            <th className="px-1.5 py-1 text-right font-medium">GD</th>
            <th className="px-1.5 py-1 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.rows.map((row, i) => (
            <tr
              key={row.team}
              className={cn(
                "border-t",
                i < 2 && "bg-primary/5",
                i === 2 && "bg-draw/5"
              )}
            >
              <td className="px-3 py-1.5">
                <span className="mr-1.5 text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <TeamLabel id={row.team} />
              </td>
              <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">
                {row.played}
              </td>
              <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
              <td className="px-1.5 py-1.5 text-right font-semibold tabular-nums">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
