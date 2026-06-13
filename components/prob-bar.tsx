import { cn } from "@/lib/utils";

/** Win / draw / loss probability strip rendered as pure divs. */
export function ProbBar({
  home,
  draw,
  away,
  className,
}: {
  home: number;
  draw: number;
  away: number;
  className?: string;
}) {
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div className="bg-win" style={{ width: pct(home) }} />
        <div className="bg-draw" style={{ width: pct(draw) }} />
        <div className="bg-loss" style={{ width: pct(away) }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pct(home)}</span>
        <span>D {pct(draw)}</span>
        <span>{pct(away)}</span>
      </div>
    </div>
  );
}
