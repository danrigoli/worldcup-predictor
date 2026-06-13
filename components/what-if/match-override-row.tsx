"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { TeamLabel } from "@/components/team-label";
import { cn } from "@/lib/utils";
import { useOverrideStore } from "@/components/what-if/override-store";
import type { Match, Override, TeamId } from "@/lib/types";

const MAX = 9;

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="rounded bg-secondary p-0.5 hover:bg-secondary/70"
        aria-label="decrease"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-4 text-center tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(MAX, value + 1))}
        className="rounded bg-secondary p-0.5 hover:bg-secondary/70"
        aria-label="increase"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

export function MatchOverrideRow({ match }: { match: Match }) {
  const overrides = useOverrideStore((s) => s.overrides);
  const setOverride = useOverrideStore((s) => s.setOverride);
  const clearOverride = useOverrideStore((s) => s.clearOverride);

  if (match.home.kind !== "team" || match.away.kind !== "team") return null;
  const homeTeam = match.home.team;
  const awayTeam = match.away.team;
  const isKnockout = match.stage !== "group";

  const override = overrides[match.matchNumber];
  // Default the editor to the actual result if played, else 0–0.
  const homeScore = override?.homeScore ?? match.homeScore ?? 0;
  const awayScore = override?.awayScore ?? match.awayScore ?? 0;
  const active = Boolean(override);

  const apply = (patch: Partial<Override>) => {
    const next: Override = {
      homeScore,
      awayScore,
      winnerOnPens: override?.winnerOnPens,
      ...patch,
    };
    if (isKnockout && next.homeScore === next.awayScore && !next.winnerOnPens) {
      next.winnerOnPens = "home";
    }
    setOverride(match.matchNumber, next);
  };

  const pensWinner: "home" | "away" | undefined =
    isKnockout && homeScore === awayScore
      ? override?.winnerOnPens ?? "home"
      : undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm",
        active && "border-primary/50 bg-primary/5"
      )}
    >
      <TeamLabel id={homeTeam} flagOnly className="shrink-0" />
      <div className="ml-auto flex items-center gap-2">
        <Stepper value={homeScore} onChange={(v) => apply({ homeScore: v })} />
        <span className="text-muted-foreground">–</span>
        <Stepper value={awayScore} onChange={(v) => apply({ awayScore: v })} />
      </div>
      <TeamLabel id={awayTeam} flagOnly className="shrink-0" />
      {pensWinner && (
        <PensToggle
          home={homeTeam}
          away={awayTeam}
          value={pensWinner}
          onChange={(w) => apply({ winnerOnPens: w })}
        />
      )}
      <button
        onClick={() => clearOverride(match.matchNumber)}
        disabled={!active}
        className={cn(
          "rounded p-1 text-muted-foreground hover:bg-secondary",
          !active && "invisible"
        )}
        aria-label="reset match"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function PensToggle({
  home,
  away,
  value,
  onChange,
}: {
  home: TeamId;
  away: TeamId;
  value: "home" | "away";
  onChange: (w: "home" | "away") => void;
}) {
  return (
    <div className="flex items-center gap-0.5 text-xs">
      <span className="text-muted-foreground">pens</span>
      <button
        onClick={() => onChange("home")}
        className={cn(
          "rounded px-1",
          value === "home" ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        <TeamLabel id={home} flagOnly />
      </button>
      <button
        onClick={() => onChange("away")}
        className={cn(
          "rounded px-1",
          value === "away" ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        <TeamLabel id={away} flagOnly />
      </button>
    </div>
  );
}
