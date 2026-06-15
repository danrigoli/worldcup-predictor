/** Canonical team id: FIFA trigram, e.g. "ARG", "KOR". */
export type TeamId = string;

export type GroupLetter =
  | "A" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L";

export type Stage =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "third-place"
  | "final";

export interface TeamInfo {
  id: TeamId;
  name: string;
  flag: string;
  group: GroupLetter;
}

/** A side of a match: a concrete team, or a placeholder resolved during the sim. */
export type Slot =
  | { kind: "team"; team: TeamId }
  | { kind: "group-rank"; group: GroupLetter; rank: 1 | 2 }
  | { kind: "third-pool"; groups: GroupLetter[] }
  | { kind: "match-winner"; matchNumber: number }
  | { kind: "match-loser"; matchNumber: number };

export type HostCountry = "United States" | "Mexico" | "Canada";

export interface Match {
  matchNumber: number; // 1..104
  stage: Stage;
  group: GroupLetter | null;
  dateUtc: string; // ISO 8601
  venue: string;
  hostCountry: HostCountry;
  home: Slot;
  away: Slot;
  /** Actual scores when played (90'+ET total for knockouts), null otherwise. */
  homeScore: number | null;
  awayScore: number | null;
  /** Actual advancing team for played knockouts (covers penalty shootouts). */
  winner: TeamId | null;
}

/** A user-imposed result in the what-if simulator. */
export interface Override {
  homeScore: number;
  awayScore: number;
  /** Required when a knockout override is a draw. */
  winnerOnPens?: "home" | "away";
}

export type Overrides = Record<number, Override>;

/** Per-team probability of reaching each stage (cumulative, monotone). */
export interface StageOdds {
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  winner: number;
}

export type OddsByTeam = Record<TeamId, StageOdds>;

export interface SimResult {
  simCount: number;
  seed: number;
  odds: OddsByTeam;
}

export type Ratings = Record<TeamId, number>;

export interface Snapshot {
  date: string; // YYYY-MM-DD
  generatedAt: string; // ISO
  seed: number;
  simCount: number;
  playedMatches: number;
  odds: OddsByTeam;
}

export interface MatchProbabilities {
  home: number;
  draw: number;
  away: number;
  topScorelines: Array<{ home: number; away: number; p: number }>;
  /** Most likely exact score within each outcome. */
  byOutcome: {
    home: { home: number; away: number; p: number };
    draw: { home: number; away: number; p: number };
    away: { home: number; away: number; p: number };
  };
}

/** Per-side in-match statistics (from ESPN). null when unavailable. */
export interface MatchStats {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
}

/** Live status for a match, fetched from ESPN on a short cache. */
export interface LiveInfo {
  /** "pre" = not started, "in" = in progress, "post" = finished. */
  state: "pre" | "in" | "post";
  /** Short status, e.g. "FT", "HT", "62'". */
  detail: string;
  /** Display clock for in-progress matches, e.g. "62'", "90'+3'". */
  clock: string | null;
  homeScore: number | null;
  awayScore: number | null;
  stats: { home: MatchStats; away: MatchStats } | null;
}

export type LiveByMatch = Record<number, LiveInfo>;

/** Lineup-derived strength penalty for one side of a match. */
export interface TeamLineup {
  /** 0–CAP fractional strength reduction from the fielded XI vs best XI. */
  penalty: number;
  /** Notable squad players absent from the confirmed XI (display names). */
  missing: string[];
}

export interface MatchLineup {
  home: TeamLineup;
  away: TeamLineup;
}

export type LineupByMatch = Record<number, MatchLineup>;
