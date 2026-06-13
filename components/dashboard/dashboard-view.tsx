"use client";

import { useState } from "react";
import { formatPct, groupColor } from "@/lib/utils";
import type { StageOdds, TeamId } from "@/lib/types";

export interface DashTeam {
  id: TeamId;
  name: string;
  flag: string;
  group: string;
  odds: StageOdds;
}

type SortKey = keyof StageOdds;

const COLS: { key: SortKey; label: string }[] = [
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16" },
  { key: "qf", label: "QF" },
  { key: "sf", label: "SF" },
  { key: "final", label: "Final" },
  { key: "winner", label: "Champion" },
];

const FUNNEL: { key: SortKey; label: string }[] = [
  { key: "r32", label: "Round 32" },
  { key: "r16", label: "Round 16" },
  { key: "qf", label: "Quarter-final" },
  { key: "sf", label: "Semi-final" },
  { key: "final", label: "Final" },
  { key: "winner", label: "Champion" },
];

const card =
  "rounded-lg border border-line bg-card p-5 shadow-kit";

export function DashboardView({
  teams,
  simCount,
  played,
  source,
  stale,
}: {
  teams: DashTeam[];
  simCount: number;
  played: number;
  source: string;
  stale: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("winner");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const ranked = [...teams].sort((a, b) => b.odds.winner - a.odds.winner);
  const fav = ranked[0];
  const favWin = fav.odds.winner;
  const maxWin = ranked[0].odds.winner;
  const top12 = ranked.slice(0, 12);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };
  const tableRows = [...teams].sort((a, b) => {
    const v = b.odds[sortKey] - a.odds[sortKey];
    return sortDir === "desc" ? v : -v;
  });

  // Favourite gauge donut
  const C = 2 * Math.PI * 40;

  const stats = [
    { label: "SIMULATIONS", value: simCount.toLocaleString(), sub: "per refresh · seeded PRNG" },
    { label: "MATCHES PLAYED", value: `${played} / 104`, sub: "predictions update as results land" },
    { label: "DATA SOURCE", value: source, sub: "ML matrix · Elo + FIFA + value" },
  ];

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section
        className="relative mb-[18px] overflow-hidden rounded-[24px] p-[clamp(24px,4vw,38px)]"
        style={{ background: "var(--hero-bg)" }}
      >
        <div
          className="pointer-events-none absolute bottom-[-34%] right-[-2%] z-[1] font-display font-extrabold leading-none"
          style={{
            fontSize: "clamp(220px,34vw,400px)",
            color: "var(--hero-wm)",
            letterSpacing: "-12px",
          }}
        >
          26
        </div>
        <div className="relative z-[2] flex flex-wrap items-center justify-between gap-[26px]">
          <div className="min-w-0 max-w-[560px] flex-1 basis-[380px]">
            <div
              className="inline-flex items-center gap-2 rounded-full px-[13px] py-1.5 text-[11px] font-extrabold tracking-[1.2px]"
              style={{ background: "var(--hero-chip-bg)", color: "var(--hero-chip-ink)" }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full bg-current"
                style={{ animation: "wcpulse 1.6s ease infinite" }}
              />
              LIVE FORECAST
            </div>
            <h1
              className="my-[14px] mb-4 font-display font-extrabold"
              style={{
                fontSize: "clamp(34px,4.4vw,52px)",
                lineHeight: 1.02,
                letterSpacing: "-1.6px",
                color: "var(--hero-ink)",
              }}
            >
              THE ROAD TO <span style={{ color: "var(--hero-accent)" }}>2026</span>
            </h1>
            <p
              className="m-0 max-w-[450px] text-[15px] leading-[1.5]"
              style={{ color: "var(--hero-muted)" }}
            >
              Win probabilities for all 48 nations across the United States,
              Canada &amp; Mexico — from {simCount.toLocaleString()} Monte Carlo
              tournament simulations, refreshed as results land.
            </p>
          </div>
          <div
            className="flex flex-none items-center gap-[18px] rounded-[20px] border p-[18px_22px] backdrop-blur-[8px]"
            style={{ background: "var(--hero-card)", borderColor: "var(--hero-card-line)" }}
          >
            <div className="relative h-[98px] w-[98px] flex-shrink-0">
              <svg width={98} height={98} viewBox="0 0 98 98" style={{ transform: "rotate(-90deg)" }}>
                <circle cx={49} cy={49} r={40} fill="none" stroke="var(--hero-track)" strokeWidth={9} />
                <circle
                  cx={49}
                  cy={49}
                  r={40}
                  fill="none"
                  stroke="var(--hero-accent)"
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeDasharray={`${favWin * C} ${C}`}
                />
              </svg>
              <div
                className="absolute inset-0 grid place-items-center font-display text-[21px] font-extrabold"
                style={{ color: "var(--hero-ink)" }}
              >
                {formatPct(favWin)}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] font-extrabold tracking-[1.5px]" style={{ color: "var(--hero-muted)" }}>
                TOURNAMENT FAVOURITE
              </div>
              <div className="mb-0.5 mt-1.5 text-[32px] leading-none">{fav.flag}</div>
              <div
                className="font-display text-[23px] font-extrabold leading-none tracking-[-0.5px]"
                style={{ color: "var(--hero-ink)" }}
              >
                {fav.name}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--hero-muted)" }}>
                to lift the trophy
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat chips */}
      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[14px]">
        {stats.map((c) => (
          <div key={c.label} className="rounded-lg border border-line bg-card p-[16px_18px] shadow-kit">
            <div className="text-[10.5px] font-extrabold tracking-[1.2px] text-[var(--muted)]">
              {c.label}
              {stale && c.label === "DATA SOURCE" ? " ·  ⚠ stale" : ""}
            </div>
            <div className="my-[5px] mb-0.5 font-display text-[27px] font-extrabold tracking-[-0.5px] text-ink">
              {c.value}
            </div>
            <div className="text-xs text-[var(--muted)]">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Title odds + Path to glory */}
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4">
        <div className={card}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="m-0 font-display text-base font-extrabold tracking-[-0.3px] text-ink">
              Title odds — top 12
            </h2>
            <span className="text-[11px] font-bold text-[var(--muted)]">% to win</span>
          </div>
          <div className="flex flex-col gap-[9px]">
            {top12.map((t, i) => (
              <div key={t.id} className="grid grid-cols-[150px_1fr_44px] items-center gap-2.5">
                <div className="flex items-center gap-[7px] overflow-hidden whitespace-nowrap text-[13px] font-semibold text-ink">
                  <span className="text-base">{t.flag}</span>
                  <span className="overflow-hidden text-ellipsis">{t.name}</span>
                </div>
                <div className="h-[18px] overflow-hidden rounded-md bg-track">
                  <div
                    className="h-full rounded-md"
                    style={{
                      width: `${(t.odds.winner / maxWin) * 100}%`,
                      transformOrigin: "left",
                      animation: "wcbar .7s cubic-bezier(.2,.7,.2,1) both",
                      background:
                        i === 0
                          ? "linear-gradient(90deg,var(--accent),var(--accent2))"
                          : "color-mix(in srgb, var(--accent) 58%, transparent)",
                      boxShadow: i === 0 ? "0 0 12px color-mix(in srgb,var(--accent) 45%,transparent)" : "none",
                    }}
                  />
                </div>
                <div className="text-right text-[13px] font-extrabold tabular-nums text-ink">
                  {formatPct(t.odds.winner)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <h2 className="m-0 font-display text-base font-extrabold tracking-[-0.3px] text-ink">
            Path to glory
          </h2>
          <p className="my-2.5 mb-4 text-[13px] leading-[1.55] text-[var(--muted)]">
            Each nation&apos;s strength comes from a <strong className="text-ink">LightGBM goals model</strong>{" "}
            trained on ~49,000 internationals plus squad market values. The
            bracket is simulated {simCount.toLocaleString()} times.
          </p>
          <div className="flex flex-col gap-2">
            {FUNNEL.map((f) => (
              <div key={f.key} className="grid grid-cols-[84px_1fr_52px] items-center gap-2.5">
                <div className="text-[11px] font-extrabold tracking-[0.5px] text-[var(--muted)]">
                  {f.label}
                </div>
                <div className="h-[14px] overflow-hidden rounded-[5px] bg-track">
                  <div
                    className="h-full rounded-[5px]"
                    style={{
                      width: `${Math.max(3, fav.odds[f.key] * 100)}%`,
                      transformOrigin: "left",
                      animation: "wcbar .7s ease both",
                      background: "linear-gradient(90deg,var(--accent),var(--accent2))",
                    }}
                  />
                </div>
                <div className="text-right text-[12.5px] font-bold tabular-nums text-ink">
                  {formatPct(fav.odds[f.key])}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3.5 flex items-center gap-[7px] text-[11px] text-[var(--muted)]">
            <span className="text-[15px]">{fav.flag}</span> {fav.name}&apos;s survival
            odds by round
          </div>
        </div>
      </div>

      {/* Sortable 48-team table */}
      <div className={card}>
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 font-display text-base font-extrabold tracking-[-0.3px] text-ink">
            All 48 teams — stage-by-stage odds
          </h2>
          <span className="text-[11px] font-bold text-[var(--muted)]">tap a column to sort</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="sticky top-0 w-10 bg-panel p-[10px_12px] text-left text-[11px] font-extrabold tracking-[0.5px] text-[var(--muted)]">
                  #
                </th>
                <th className="sticky top-0 bg-panel p-[10px_12px] text-left text-[11px] font-extrabold tracking-[0.5px] text-[var(--muted)]">
                  Team
                </th>
                <th className="sticky top-0 bg-panel p-[10px_12px] text-left text-[11px] font-extrabold tracking-[0.5px] text-[var(--muted)]">
                  Grp
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className="sticky top-0 bg-panel p-[10px_12px] text-right">
                    <button
                      onClick={() => setSort(c.key)}
                      className={`ml-auto block cursor-pointer border-none bg-none p-0 text-[11px] font-extrabold tracking-[0.5px] ${
                        sortKey === c.key ? "text-ink" : "text-[var(--muted)]"
                      }`}
                    >
                      {c.label}
                      {sortKey === c.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((t, i) => (
                <tr
                  key={t.id}
                  className="border-b border-line"
                  style={{
                    background: i % 2 ? "color-mix(in srgb, var(--panel) 35%, transparent)" : "transparent",
                  }}
                >
                  <td className="p-[8px_12px] font-bold tabular-nums text-[var(--muted)]">{i + 1}</td>
                  <td className="whitespace-nowrap p-[8px_12px]">
                    <span className="mr-[7px] text-base">{t.flag}</span>
                    <span className="font-semibold text-ink">{t.name}</span>
                  </td>
                  <td className="p-[8px_10px]">
                    <span
                      className="inline-grid h-[22px] w-[22px] place-items-center rounded-md text-[11px] font-extrabold text-white"
                      style={{ background: groupColor(t.group) }}
                    >
                      {t.group}
                    </span>
                  </td>
                  {COLS.map((c) => (
                    <td
                      key={c.key}
                      className="p-[8px_12px] text-right tabular-nums"
                      style={{
                        fontWeight: c.key === sortKey ? 800 : c.key === "winner" ? 700 : 500,
                        color: c.key === sortKey || c.key === "winner" ? "var(--ink)" : "var(--muted)",
                      }}
                    >
                      {formatPct(t.odds[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
