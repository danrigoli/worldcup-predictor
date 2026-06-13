import { TEAM_BY_ID } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { TeamId } from "@/lib/types";

export function TeamLabel({
  id,
  className,
  flagOnly = false,
}: {
  id: TeamId;
  className?: string;
  flagOnly?: boolean;
}) {
  const team = TEAM_BY_ID[id];
  if (!team) return <span className={className}>{id}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden>{team.flag}</span>
      {!flagOnly && <span>{team.name}</span>}
    </span>
  );
}
