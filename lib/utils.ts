import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(p: number, digits = 1): string {
  if (p > 0 && p < 0.001) return "<0.1%";
  return `${(p * 100).toFixed(digits)}%`;
}

/** FIFA-26 group color system (groups A–L) from the design. */
const GROUP_COLORS = [
  "#ff4d3d", "#ff8a00", "#f2c200", "#9ee61e", "#2ecc71", "#00c2a8",
  "#26b0ff", "#3a6bff", "#8b6cff", "#c44dff", "#ff4db8", "#ff7a6b",
];

export function groupColor(group: string): string {
  const i = "ABCDEFGHIJKL".indexOf(group);
  return GROUP_COLORS[i] ?? GROUP_COLORS[0];
}
