"use client";

import { useState } from "react";
import { format } from "date-fns";
import { TEAM_BY_ID } from "@/lib/names";
import { roundOf } from "@/lib/rounds";
import { formatPct, groupColor } from "@/lib/utils";
import type {
  LiveByMatch,
  LiveInfo,
  Match,
  MatchProbabilities,
  MatchStats,
  Slot,
} from "@/lib/types";
import type { GroupStandings } from "@/lib/sim/groups";

const GROUPS = "ABCDEFGHIJKL".split("");

function slotLabel(slot: Slot): { flag: string; name: string } {
  switch (slot.kind) {
    case "team":
      return { flag: TEAM_BY_ID[slot.team].flag, name: TEAM_BY_ID[slot.team].name };
    case "group-rank":
      return { flag: "", name: `${slot.rank === 1 ? "Winner" : "2nd"} Grp ${slot.group}` };
    case "third-pool":
      return { flag: "", name: `3rd · ${slot.groups.join("/")}` };
    case "match-winner":
      return { flag: "", name: `Winner M${slot.matchNumber}` };
    case "match-loser":
      return { flag: "", name: `Loser M${slot.matchNumber}` };
  }
}

export function MatchesView({
  matches,
  predictions,
  standings,
  live,
}: {
  matches: Match[];
  predictions: Record<number, MatchProbabilities>;
  standings: GroupStandings[];
  live: LiveByMatch;
}) {
  const [mode, setMode] = useState<"group" | "day">("group");
  const liveCount = Object.values(live).filter((l) => l.state === "in").length;

  return (
    <div className="animate-fade-in">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 mb-1 font-display text-[34px] font-extrabold tracking-[-1px] text-ink">
            Matches
          </h1>
          <p className="m-0 text-sm text-[var(--muted)]">
            Win / draw / loss probabilities and most-likely scorelines for every
            fixture. Results lock in as they&apos;re played.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--neg)_15%,transparent)] px-2.5 py-1 text-[11px] font-extrabold tracking-[0.5px] text-[var(--neg)]">
              <span className="h-[7px] w-[7px] rounded-full bg-[var(--neg)]" style={{ animation: "wcpulse 1.4s ease infinite" }} />
              {liveCount} LIVE
            </span>
          )}
          <div className="flex gap-[3px] rounded-xl border border-line bg-panel p-[3px]">
            {(["group", "day"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-[9px] px-3 py-1.5 text-xs font-bold transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "bg-transparent text-[var(--muted)]"
                }`}
              >
                {m === "group" ? "By group" : "By day"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === "group" ? (
        <GroupView matches={matches} predictions={predictions} standings={standings} live={live} />
      ) : (
        <DayView matches={matches} predictions={predictions} live={live} />
      )}
    </div>
  );
}

function GroupView({
  matches,
  predictions,
  standings,
  live,
}: {
  matches: Match[];
  predictions: Record<number, MatchProbabilities>;
  standings: GroupStandings[];
  live: LiveByMatch;
}) {
  const [group, setGroup] = useState("A");
  const groupMatches = matches
    .filter((m) => m.stage === "group" && m.group === group)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const standing = standings.find((s) => s.group === group);

  return (
    <>
      <div className="mb-[18px] flex flex-wrap gap-[5px]">
        {GROUPS.map((g) => {
          const active = g === group;
          return (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className="rounded-[10px] border px-[13px] py-[7px] text-[12.5px] font-bold transition-colors"
              style={{
                borderColor: active ? "transparent" : "var(--line)",
                background: active ? groupColor(g) : "var(--card)",
                color: active ? "#fff" : "var(--muted)",
              }}
            >
              Group {g}
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[11px]">
          {groupMatches.map((m) => (
            <MatchCard
              key={m.matchNumber}
              match={m}
              pred={predictions[m.matchNumber]}
              live={live[m.matchNumber]}
            />
          ))}
        </div>

        <div className="lg:sticky lg:top-[84px]">
          <div className="rounded-lg border border-line bg-card p-5 shadow-kit">
            <h2 className="m-0 font-display text-base font-extrabold tracking-[-0.3px] text-ink">
              Group {group} standings
            </h2>
            <table className="mt-3 w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-[10.5px] font-extrabold tracking-[0.5px] text-[var(--muted)]">
                  <th className="p-[4px_6px] text-left">TEAM</th>
                  <th className="p-[4px_6px] text-right">P</th>
                  <th className="p-[4px_6px] text-right">GD</th>
                  <th className="p-[4px_6px] text-right">PTS</th>
                </tr>
              </thead>
              <tbody>
                {standing?.rows.map((r, i) => {
                  const gd = r.gf - r.ga;
                  return (
                    <tr
                      key={r.team}
                      className="border-t border-line"
                      style={{
                        background:
                          i < 2
                            ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                            : i === 2
                              ? "color-mix(in srgb, var(--draw) 12%, transparent)"
                              : "transparent",
                      }}
                    >
                      <td className="p-[8px_6px]">
                        <span className="mr-1.5 text-[10px] font-bold text-[var(--muted)]">{i + 1}</span>
                        <span className="mr-1.5 text-[15px]">{TEAM_BY_ID[r.team].flag}</span>
                        <span className="font-semibold text-ink">{TEAM_BY_ID[r.team].name}</span>
                      </td>
                      <td className="p-[8px_6px] text-right tabular-nums text-[var(--muted)]">{r.played}</td>
                      <td className="p-[8px_6px] text-right tabular-nums text-[var(--muted)]">
                        {gd > 0 ? "+" : ""}
                        {gd}
                      </td>
                      <td className="p-[8px_6px] text-right font-extrabold tabular-nums text-ink">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 flex gap-3.5 text-[10.5px] font-semibold text-[var(--muted)]">
              <span className="flex items-center gap-[5px]">
                <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: "var(--accent)" }} />
                Advance
              </span>
              <span className="flex items-center gap-[5px]">
                <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: "var(--draw)" }} />
                Best-3rd race
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DayView({
  matches,
  predictions,
  live,
}: {
  matches: Match[];
  predictions: Record<number, MatchProbabilities>;
  live: LiveByMatch;
}) {
  // Distinct match dates (UTC calendar day), sorted.
  const days = [...new Set(matches.map((m) => m.dateUtc.slice(0, 10)))].sort();
  const today = new Date().toISOString().slice(0, 10);
  const liveDays = new Set(
    matches
      .filter((m) => live[m.matchNumber]?.state === "in")
      .map((m) => m.dateUtc.slice(0, 10))
  );
  const defaultDay =
    (liveDays.size ? [...liveDays].sort()[0] : null) ??
    (days.includes(today) ? today : days.find((d) => d >= today)) ??
    days[days.length - 1];
  const [day, setDay] = useState(defaultDay);

  const dayMatches = matches
    .filter((m) => m.dateUtc.slice(0, 10) === day)
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc) || a.matchNumber - b.matchNumber);

  return (
    <>
      <div className="no-scrollbar mb-[18px] flex gap-[5px] overflow-x-auto pb-1">
        {days.map((d) => {
          const active = d === day;
          const isToday = d === today;
          const hasLive = liveDays.has(d);
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              className="flex shrink-0 items-center gap-1.5 rounded-[10px] border px-[13px] py-[7px] text-[12.5px] font-bold transition-colors"
              style={{
                borderColor: active ? "transparent" : "var(--line)",
                background: active ? "var(--accent)" : "var(--card)",
                color: active ? "var(--accent-ink)" : "var(--muted)",
              }}
            >
              {hasLive && (
                <span className="h-[6px] w-[6px] rounded-full bg-[var(--neg)]" style={{ animation: "wcpulse 1.4s ease infinite" }} />
              )}
              {format(new Date(d + "T12:00:00Z"), "EEE d MMM")}
              {isToday && (
                <span
                  className="rounded px-1 text-[9px] font-extrabold tracking-[0.5px]"
                  style={{ background: active ? "var(--accent-ink)" : "var(--accent)", color: active ? "var(--accent)" : "#fff" }}
                >
                  TODAY
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-[11px] md:grid-cols-2">
        {dayMatches.map((m) => (
          <MatchCard
            key={m.matchNumber}
            match={m}
            pred={predictions[m.matchNumber]}
            live={live[m.matchNumber]}
            showRound
          />
        ))}
      </div>
    </>
  );
}

function MatchCard({
  match,
  pred,
  live,
  showRound,
}: {
  match: Match;
  pred?: MatchProbabilities;
  live?: LiveInfo;
  showRound?: boolean;
}) {
  const home = slotLabel(match.home);
  const away = slotLabel(match.away);
  const isLive = live?.state === "in";

  // Scores: prefer live (in/post) over the feed's stored score.
  const liveHome = live && live.state !== "pre" ? live.homeScore : null;
  const liveAway = live && live.state !== "pre" ? live.awayScore : null;
  const homeScore = liveHome ?? match.homeScore;
  const awayScore = liveAway ?? match.awayScore;
  const played = (match.homeScore !== null && match.awayScore !== null) || live?.state === "post";
  const hasScore = homeScore !== null && awayScore !== null;
  const homeWin = hasScore && homeScore! > awayScore!;
  const awayWin = hasScore && awayScore! > homeScore!;

  return (
    <div
      className="rounded-lg border bg-card p-5 shadow-kit"
      style={{ borderColor: isLive ? "var(--neg)" : "var(--line)" }}
    >
      <div className="mb-[11px] flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
        <span>
          {showRound ? `${roundOf(match.matchNumber).label} · ` : ""}
          {format(new Date(match.dateUtc), "EEE d MMM, HH:mm")} · {match.venue.replace(" Stadium", "")}
        </span>
        {isLive ? (
          <span className="flex items-center gap-1.5 font-extrabold tracking-[0.5px] text-[var(--neg)]">
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--neg)]" style={{ animation: "wcpulse 1.4s ease infinite" }} />
            LIVE {live?.clock ?? ""}
          </span>
        ) : played ? (
          <span className="font-extrabold tracking-[0.5px]" style={{ color: "var(--pos)" }}>
            {live?.detail || "FULL TIME"}
          </span>
        ) : (
          <span className="font-bold tracking-[0.5px]">UPCOMING</span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <div className="flex items-center gap-[9px] text-sm font-bold text-ink" style={{ opacity: awayWin ? 0.55 : 1 }}>
          {home.flag && <span className="text-2xl">{home.flag}</span>}
          <span>{home.name}</span>
        </div>
        <div className="px-1.5 text-center tabular-nums">
          {hasScore ? (
            <span
              className="font-display text-[22px] font-extrabold"
              style={{ color: isLive ? "var(--neg)" : "var(--ink)" }}
            >
              {homeScore}–{awayScore}
            </span>
          ) : (
            <span className="text-[13px] font-bold text-[var(--muted)]">v</span>
          )}
        </div>
        <div className="flex items-center justify-end gap-[9px] text-right text-sm font-bold text-ink" style={{ opacity: homeWin ? 0.55 : 1 }}>
          <span>{away.name}</span>
          {away.flag && <span className="text-2xl">{away.flag}</span>}
        </div>
      </div>

      {!played && !isLive && pred && (
        <div className="mt-[13px]">
          <div className="flex h-[9px] overflow-hidden rounded-md bg-track">
            <div style={{ width: `${pred.home * 100}%`, background: "var(--accent)" }} />
            <div style={{ width: `${pred.draw * 100}%`, background: "var(--muted)", opacity: 0.5 }} />
            <div style={{ width: `${pred.away * 100}%`, background: "var(--neg)" }} />
          </div>
          <div className="mt-[7px] flex justify-between text-[11px] font-bold">
            <span style={{ color: "var(--accent)" }}>{formatPct(pred.home)} W</span>
            <span className="text-[var(--muted)]">{formatPct(pred.draw)} D</span>
            <span style={{ color: "var(--neg)" }}>{formatPct(pred.away)} W</span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold tracking-[0.8px] text-[var(--muted)]">LIKELY</span>
            {pred.topScorelines.slice(0, 3).map((s, i) => (
              <span key={i} className="rounded-md border border-line bg-panel px-2 py-[3px] text-[11.5px] font-bold text-ink">
                {s.home}–{s.away} <span className="font-semibold text-[var(--muted)]">{formatPct(s.p)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {live?.stats && <StatsPanel stats={live.stats} open={isLive} />}
    </div>
  );
}

function StatsPanel({
  stats,
  open,
}: {
  stats: { home: MatchStats; away: MatchStats };
  open?: boolean;
}) {
  const hp = stats.home.possession;
  const ap = stats.away.possession;
  const rows: { label: string; h: number | null; a: number | null }[] = [
    { label: "Shots", h: stats.home.shots, a: stats.away.shots },
    { label: "On target", h: stats.home.shotsOnTarget, a: stats.away.shotsOnTarget },
    { label: "Corners", h: stats.home.corners, a: stats.away.corners },
    { label: "Fouls", h: stats.home.fouls, a: stats.away.fouls },
  ].filter((r) => r.h !== null || r.a !== null);

  return (
    <details open={open} className="mt-3 border-t border-line pt-3">
      <summary className="cursor-pointer list-none text-[11px] font-extrabold tracking-[0.5px] text-[var(--muted)]">
        MATCH STATS
      </summary>
      <div className="mt-3 space-y-2.5">
        {hp !== null && ap !== null && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-bold text-ink">
              <span>{hp}%</span>
              <span className="text-[var(--muted)]">Possession</span>
              <span>{ap}%</span>
            </div>
            <div className="flex h-[6px] overflow-hidden rounded bg-track">
              <div style={{ width: `${hp}%`, background: "var(--accent)" }} />
              <div style={{ width: `${ap}%`, background: "color-mix(in srgb, var(--accent) 35%, transparent)" }} />
            </div>
          </div>
        )}
        {rows.map((r) => {
          const h = r.h ?? 0;
          const a = r.a ?? 0;
          const tot = h + a || 1;
          return (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-[11px] font-bold text-ink">
                <span>{r.h ?? "–"}</span>
                <span className="text-[var(--muted)]">{r.label}</span>
                <span>{r.a ?? "–"}</span>
              </div>
              <div className="flex h-[5px] gap-[3px]">
                <div className="flex flex-1 justify-end overflow-hidden rounded-l">
                  <div className="h-full rounded-l" style={{ width: `${(h / tot) * 100}%`, background: "var(--accent)" }} />
                </div>
                <div className="flex flex-1 overflow-hidden rounded-r">
                  <div className="h-full rounded-r" style={{ width: `${(a / tot) * 100}%`, background: "color-mix(in srgb, var(--accent) 35%, transparent)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
