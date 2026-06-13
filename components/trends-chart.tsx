"use client";

import { TEAM_BY_ID } from "@/lib/names";
import { formatPct } from "@/lib/utils";
import type { TeamId } from "@/lib/types";

export interface TrendPoint {
  date: string;
  values: Record<TeamId, number>;
}

const COLORS = ["#ff4d3d", "#f2c200", "#2ecc71", "#26b0ff", "#8b6cff", "#ff4db8"];

export function TrendsChart({
  points,
  teams,
}: {
  points: TrendPoint[];
  teams: TeamId[];
}) {
  const top = teams.slice(0, 6);
  const n = points.length;
  const W = 720;
  const H = 240;
  const pad = 14;
  const padB = 26;

  const series = top.map((id, i) => ({
    id,
    color: COLORS[i % COLORS.length],
    pts: points.map((p) => p.values[id] ?? 0),
  }));

  const allMax = Math.max(0.05, ...series.flatMap((s) => s.pts)) * 1.12;
  const xx = (i: number) => pad + (n <= 1 ? 0 : i / (n - 1)) * (W - pad * 2);
  const yy = (v: number) => H - padB - (v / allMax) * (H - pad - padB);

  const gridLines = [0.05, 0.1, 0.15, 0.2].filter((g) => g < allMax);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
        {gridLines.map((g) => (
          <g key={g}>
            <line x1={pad} x2={W - pad} y1={yy(g)} y2={yy(g)} stroke="var(--line)" strokeWidth={1} />
            <text x={W - pad} y={yy(g) - 3} textAnchor="end" fontSize={9} fontWeight={700} fill="var(--muted)">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.id}>
            <polyline
              points={s.pts.map((v, j) => `${xx(j)},${yy(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx={xx(n - 1)}
              cy={yy(s.pts[n - 1])}
              r={3.6}
              fill={s.color}
              stroke="var(--card)"
              strokeWidth={1.5}
            />
          </g>
        ))}
        {points.map((p, i) =>
          i === 0 || i === n - 1 || i % Math.ceil(n / 4) === 0 ? (
            <text key={i} x={xx(i)} y={H - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--muted)">
              {p.date}
            </text>
          ) : null
        )}
      </svg>

      <div className="mt-[18px] flex flex-wrap gap-3.5">
        {series.map((s) => (
          <div key={s.id} className="flex items-center gap-[7px] text-[12.5px] font-semibold text-ink">
            <span className="inline-block h-1 w-3.5 rounded-[3px]" style={{ background: s.color }} />
            <span className="text-[15px]">{TEAM_BY_ID[s.id].flag}</span>
            {TEAM_BY_ID[s.id].name}
            <span className="font-bold text-[var(--muted)]">
              {formatPct(s.pts[n - 1])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
