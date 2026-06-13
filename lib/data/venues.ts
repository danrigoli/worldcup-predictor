import type { HostCountry, Match, TeamId } from "@/lib/types";
import { HOME_ADVANTAGE } from "@/lib/constants";

/** Pinned to the exact Location strings in the fixturedownload feed. */
const VENUE_COUNTRY: Record<string, HostCountry> = {
  "Atlanta Stadium": "United States",
  "Boston Stadium": "United States",
  "Dallas Stadium": "United States",
  "Houston Stadium": "United States",
  "Kansas City Stadium": "United States",
  "Los Angeles Stadium": "United States",
  "Miami Stadium": "United States",
  "New York/New Jersey Stadium": "United States",
  "Philadelphia Stadium": "United States",
  "San Francisco Bay Area Stadium": "United States",
  "Seattle Stadium": "United States",
  "Guadalajara Stadium": "Mexico",
  "Mexico City Stadium": "Mexico",
  "Monterrey Stadium": "Mexico",
  "BC Place Vancouver": "Canada",
  "Toronto Stadium": "Canada",
};

const MX = ["guadalajara", "mexico city", "monterrey"];
const CA = ["vancouver", "toronto"];

/** Resolve a venue to its host country, or null if unrecognized. */
export function hostCountryForVenueOrNull(venue: string): HostCountry | null {
  const exact = VENUE_COUNTRY[venue];
  if (exact) return exact;
  const v = venue.toLowerCase();
  if (MX.some((c) => v.includes(c))) return "Mexico";
  if (CA.some((c) => v.includes(c))) return "Canada";
  return null;
}

/**
 * Host country for a venue. Unknown venues default to the United States (the
 * majority host); this only matters if a US team plays at an unrecognized
 * venue, so setup-data validates every feed venue against the known map and
 * fails loudly on drift — keeping this resilient at runtime.
 */
export function hostCountryForVenue(venue: string): HostCountry {
  return hostCountryForVenueOrNull(venue) ?? "United States";
}

const HOST_TEAM: Record<string, HostCountry> = {
  USA: "United States",
  MEX: "Mexico",
  CAN: "Canada",
};

/**
 * Net Elo home advantage for the home side of a match: hosts get the bonus
 * only in their own country; if the listed away side is the host, the net
 * advantage flips negative.
 */
export function netHomeAdvantage(
  match: Pick<Match, "hostCountry">,
  homeTeam: TeamId,
  awayTeam: TeamId
): number {
  const homeBonus = HOST_TEAM[homeTeam] === match.hostCountry ? HOME_ADVANTAGE : 0;
  const awayBonus = HOST_TEAM[awayTeam] === match.hostCountry ? HOME_ADVANTAGE : 0;
  return homeBonus - awayBonus;
}
