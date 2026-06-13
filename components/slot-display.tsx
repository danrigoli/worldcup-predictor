import { TeamLabel } from "@/components/team-label";
import { cn } from "@/lib/utils";
import type { Slot } from "@/lib/types";

/** Render a match side: a concrete team, or a bracket placeholder label. */
export function SlotDisplay({
  slot,
  className,
}: {
  slot: Slot;
  className?: string;
}) {
  if (slot.kind === "team") {
    return <TeamLabel id={slot.team} className={className} />;
  }
  return (
    <span className={cn("text-muted-foreground", className)}>
      {slotLabel(slot)}
    </span>
  );
}

export function slotLabel(slot: Slot): string {
  switch (slot.kind) {
    case "team":
      return slot.team;
    case "group-rank":
      return `${slot.rank === 1 ? "Winner" : "Runner-up"} Group ${slot.group}`;
    case "third-pool":
      return `3rd: ${slot.groups.join("/")}`;
    case "match-winner":
      return `Winner of M${slot.matchNumber}`;
    case "match-loser":
      return `Loser of M${slot.matchNumber}`;
  }
}
