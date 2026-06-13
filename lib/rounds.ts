export interface RoundDef {
  key: string;
  label: string;
}

/** Map a match number (1..104) to its display round. */
export function roundOf(matchNumber: number): RoundDef {
  if (matchNumber <= 24) return { key: "md1", label: "Matchday 1" };
  if (matchNumber <= 48) return { key: "md2", label: "Matchday 2" };
  if (matchNumber <= 72) return { key: "md3", label: "Matchday 3" };
  if (matchNumber <= 88) return { key: "r32", label: "Round of 32" };
  if (matchNumber <= 96) return { key: "r16", label: "Round of 16" };
  if (matchNumber <= 100) return { key: "qf", label: "Quarter-finals" };
  if (matchNumber <= 102) return { key: "sf", label: "Semi-finals" };
  return { key: "final", label: "Final & 3rd place" };
}

export const ROUND_ORDER = [
  "md1",
  "md2",
  "md3",
  "r32",
  "r16",
  "qf",
  "sf",
  "final",
] as const;
