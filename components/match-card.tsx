import { format } from "date-fns";
import { TEAM_BY_ID } from "@/lib/names";
import { cn } from "@/lib/utils";
import { SlotDisplay } from "@/components/slot-display";
import { ProbBar } from "@/components/prob-bar";
import { ScorelineList } from "@/components/scoreline-list";
import type { Match, MatchProbabilities } from "@/lib/types";

export function MatchCard({
  match,
  prediction,
}: {
  match: Match;
  prediction?: MatchProbabilities;
}) {
  const played = match.homeScore !== null && match.awayScore !== null;
  const winnerId = match.winner;

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{format(new Date(match.dateUtc), "EEE d MMM, HH:mm")}</span>
        <span>{match.venue.replace(" Stadium", "")}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div
          className={cn(
            "justify-self-start text-sm",
            winnerId &&
              match.home.kind === "team" &&
              match.home.team === winnerId &&
              "font-semibold"
          )}
        >
          <SlotDisplay slot={match.home} />
        </div>
        <div className="px-2 text-center tabular-nums">
          {played ? (
            <span className="text-lg font-bold">
              {match.homeScore}–{match.awayScore}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">v</span>
          )}
        </div>
        <div
          className={cn(
            "justify-self-end text-right text-sm",
            winnerId &&
              match.away.kind === "team" &&
              match.away.team === winnerId &&
              "font-semibold"
          )}
        >
          <SlotDisplay slot={match.away} />
        </div>
      </div>

      {!played && prediction && (
        <div className="mt-3 grid grid-cols-[2fr_1fr] gap-3">
          <ProbBar
            home={prediction.home}
            draw={prediction.draw}
            away={prediction.away}
          />
          <ScorelineList scorelines={prediction.topScorelines.slice(0, 3)} />
        </div>
      )}

      {played && (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {match.group
            ? `Group ${match.group}`
            : winnerId
              ? `${TEAM_BY_ID[winnerId]?.name ?? winnerId} advance`
              : "Full time"}
        </div>
      )}
    </div>
  );
}
