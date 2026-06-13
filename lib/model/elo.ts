import { ELO_SEED_RATING, K_FACTORS } from "@/lib/constants";

/** Win expectancy for a side with net rating advantage `ratingDiff` (incl. HA). */
export function expectedScore(ratingDiff: number): number {
  return 1 / (1 + Math.pow(10, -ratingDiff / 400));
}

/** World Football Elo goal-difference multiplier. */
export function gFactor(goalDiff: number): number {
  const n = Math.abs(goalDiff);
  if (n <= 1) return 1;
  if (n === 2) return 1.5;
  return (11 + n) / 8;
}

/** Map a martj42 tournament label to a World Football Elo K-factor. */
export function kFactorForTournament(tournament: string): number {
  const t = tournament.toLowerCase();
  if (t.includes("qualification")) return K_FACTORS.qualifier;
  if (t === "fifa world cup") return K_FACTORS.worldCup;
  if (t === "friendly") return K_FACTORS.friendly;
  const continental = [
    "copa america",
    "uefa euro",
    "african cup of nations",
    "africa cup of nations",
    "afc asian cup",
    "gold cup",
    "concacaf championship",
    "oceania nations cup",
    "ofc nations cup",
    "confederations cup",
  ];
  const plain = t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (continental.some((c) => plain.includes(c))) return K_FACTORS.continentalFinal;
  return K_FACTORS.tournament;
}

/**
 * Elo update for one match. Returns the rating deltas (home delta = -away delta).
 * `homeAdvantage` must be 0 for neutral-venue matches.
 */
export function eloDelta(
  ratingHome: number,
  ratingAway: number,
  homeGoals: number,
  awayGoals: number,
  k: number,
  homeAdvantage: number
): number {
  const we = expectedScore(ratingHome + homeAdvantage - ratingAway);
  const w = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
  const g = gFactor(homeGoals - awayGoals);
  return k * g * (w - we);
}

export interface HistoricalMatch {
  date: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  tournament: string;
  neutral: boolean;
}

export interface HistoryEntry {
  rating: number;
  matches: number;
  lastMatch: string;
}

/**
 * Run Elo over a chronologically sorted match history, keyed by raw team
 * names (canonical mapping happens after, for the 48 WC teams only).
 */
export function runHistory(
  matches: HistoricalMatch[],
  homeAdvantage: number
): Map<string, HistoryEntry> {
  const table = new Map<string, HistoryEntry>();
  const get = (team: string): HistoryEntry => {
    let e = table.get(team);
    if (!e) {
      e = { rating: ELO_SEED_RATING, matches: 0, lastMatch: "" };
      table.set(team, e);
    }
    return e;
  };
  for (const m of matches) {
    const home = get(m.home);
    const away = get(m.away);
    const k = kFactorForTournament(m.tournament);
    const delta = eloDelta(
      home.rating,
      away.rating,
      m.homeScore,
      m.awayScore,
      k,
      m.neutral ? 0 : homeAdvantage
    );
    home.rating += delta;
    away.rating -= delta;
    home.matches++;
    away.matches++;
    home.lastMatch = m.date;
    away.lastMatch = m.date;
  }
  return table;
}
