"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TEAM_BY_ID } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { TeamId } from "@/lib/types";

export interface TrendPoint {
  date: string;
  values: Record<TeamId, number>;
}

const COLORS = [
  "#22c55e", "#3b82f6", "#ef4444", "#f59e0b", "#a855f7",
  "#ec4899", "#14b8a6", "#f97316",
];

export function TrendsChart({
  points,
  teams,
}: {
  points: TrendPoint[];
  teams: TeamId[];
}) {
  const [selected, setSelected] = useState<TeamId[]>(teams.slice(0, 6));

  const data = points.map((p) => {
    const row: Record<string, number | string> = { date: p.date };
    for (const id of teams) row[id] = (p.values[id] ?? 0) * 100;
    return row;
  });

  const toggle = (id: TeamId) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {teams.map((id, i) => (
          <button
            key={id}
            onClick={() => toggle(id)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs transition-colors",
              selected.includes(id)
                ? "bg-secondary text-foreground"
                : "text-muted-foreground"
            )}
            style={
              selected.includes(id)
                ? { borderColor: COLORS[i % COLORS.length] }
                : undefined
            }
          >
            {TEAM_BY_ID[id]?.flag} {TEAM_BY_ID[id]?.name}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={{ left: -8, right: 12, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v, name) => [
              `${Number(v).toFixed(1)}%`,
              TEAM_BY_ID[name as TeamId]?.name ?? String(name),
            ]}
          />
          {teams.map((id, i) =>
            selected.includes(id) ? (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground">
        Each point is a saved daily snapshot of championship odds; the latest
        point is the current live model.
      </p>
    </div>
  );
}
