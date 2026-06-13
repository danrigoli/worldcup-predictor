"use client";

import { useState } from "react";
import { format } from "date-fns";
import { TEAM_BY_ID } from "@/lib/names";
import { formatPct, groupColor } from "@/lib/utils";
import type { Match, MatchProbabilities, TeamId } from "@/lib/types";
import type { GroupStandings } from "@/lib/sim/groups";

const GROUPS = "ABCDEFGHIJKL".split("");

export function MatchesView({
  matches,
  predictions,
  standings,
}: {
  matches: Match[];
  predictions: Record<number, MatchProbabilities>;
  standings: GroupStandings[];
}) {
  const [group, setGroup] = useState("A");

  const groupMatches = matches
    .filter((m) => m.stage === "group" && m.group === group)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const standing = standings.find((s) => s.group === group);

  return (
    <div className="animate-fade-in">
      <div className="mb-[18px]">
        <h1 className="m-0 mb-1 font-display text-[34px] font-extrabold tracking-[-1px] text-ink">
          Matches
        </h1>
        <p className="m-0 text-sm text-[var(--muted)]">
          Win / draw / loss probabilities and most-likely scorelines for every
          fixture. Results lock in as they&apos;re played.
        </p>
      </div>

      {/* Group tabs */}
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
        {/* Match cards */}
        <div className="flex flex-col gap-[11px]">
          {groupMatches.map((m) => (
            <MatchCard key={m.matchNumber} match={m} pred={predictions[m.matchNumber]} />
          ))}
        </div>

        {/* Standings */}
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
    </div>
  );
}

function MatchCard({ match, pred }: { match: Match; pred?: MatchProbabilities }) {
  const home = match.home.kind === "team" ? TEAM_BY_ID[match.home.team] : null;
  const away = match.away.kind === "team" ? TEAM_BY_ID[match.away.team] : null;
  if (!home || !away) return null;

  const played = match.homeScore !== null && match.awayScore !== null;
  const homeWin = played && match.homeScore! > match.awayScore!;
  const awayWin = played && match.awayScore! > match.homeScore!;

  return (
    <div className="rounded-lg border border-line bg-card p-5 shadow-kit">
      <div className="mb-[11px] flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
        <span>{format(new Date(match.dateUtc), "EEE d MMM")} · {match.venue.replace(" Stadium", "")}</span>
        <span
          className="font-extrabold tracking-[0.5px]"
          style={{ color: played ? "var(--pos)" : "var(--muted)" }}
        >
          {played ? "FULL TIME" : "UPCOMING"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <div
          className="flex items-center gap-[9px] text-sm font-bold text-ink"
          style={{ opacity: awayWin ? 0.55 : 1 }}
        >
          <span className="text-2xl">{home.flag}</span>
          <span>{home.name}</span>
        </div>
        <div className="px-1.5 text-center tabular-nums">
          {played ? (
            <span className="font-display text-[22px] font-extrabold text-ink">
              {match.homeScore}–{match.awayScore}
            </span>
          ) : (
            <span className="text-[13px] font-bold text-[var(--muted)]">v</span>
          )}
        </div>
        <div
          className="flex items-center justify-end gap-[9px] text-right text-sm font-bold text-ink"
          style={{ opacity: homeWin ? 0.55 : 1 }}
        >
          <span>{away.name}</span>
          <span className="text-2xl">{away.flag}</span>
        </div>
      </div>

      {!played && pred && (
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
              <span
                key={i}
                className="rounded-md border border-line bg-panel px-2 py-[3px] text-[11.5px] font-bold text-ink"
              >
                {s.home}–{s.away}{" "}
                <span className="font-semibold text-[var(--muted)]">{formatPct(s.p)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {played && (
        <div className="mt-2.5 text-center text-[11px] font-bold text-[var(--muted)]">
          Group {match.group} · {match.venue}
        </div>
      )}
    </div>
  );
}
