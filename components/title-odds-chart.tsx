"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TEAM_BY_ID } from "@/lib/names";
import { formatPct } from "@/lib/utils";
import type { OddsByTeam, TeamId } from "@/lib/types";

export function TitleOddsChart({ odds, top = 12 }: { odds: OddsByTeam; top?: number }) {
  const data = (Object.keys(odds) as TeamId[])
    .map((id) => ({
      id,
      name: `${TEAM_BY_ID[id]?.flag ?? ""} ${TEAM_BY_ID[id]?.name ?? id}`,
      value: odds[id].winner,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 28)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--secondary))" }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v) => [formatPct(Number(v)), "Champion"]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={d.id} fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.55)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
