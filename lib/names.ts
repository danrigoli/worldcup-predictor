import type { GroupLetter, TeamId, TeamInfo } from "@/lib/types";

/**
 * Canonical team registry for the 48 WC2026 teams. Ids are FIFA trigrams.
 * Every external data source resolves through `resolveTeam` — aliases below
 * are pinned to the exact strings each source uses:
 *  - fixturedownload feed  → the `name` field itself ("Korea Republic", "USA", …)
 *  - martj42 results.csv   → "South Korea", "United States", "Czech Republic",
 *                            "Turkey", "Ivory Coast", "Cape Verde", "DR Congo", "Iran"
 *  - eloratings.net        → same as martj42 spellings (checked against en.teams.tsv)
 *  - ESPN scoreboard       → "South Korea", "USA", "Czechia" variants
 *  - FIFA rankings API     → matches `name` (its countryCode is the id itself)
 */
interface TeamDef extends TeamInfo {
  aliases: string[];
}

const T = (
  id: TeamId,
  name: string,
  flag: string,
  group: GroupLetter,
  aliases: string[] = []
): TeamDef => ({ id, name, flag, group, aliases });

export const TEAMS: TeamDef[] = [
  // Group A
  T("MEX", "Mexico", "🇲🇽", "A"),
  T("RSA", "South Africa", "🇿🇦", "A"),
  T("KOR", "Korea Republic", "🇰🇷", "A", ["South Korea", "Korea"]),
  T("CZE", "Czechia", "🇨🇿", "A", ["Czech Republic"]),
  // Group B
  T("CAN", "Canada", "🇨🇦", "B"),
  T("BIH", "Bosnia and Herzegovina", "🇧🇦", "B", ["Bosnia-Herzegovina", "Bosnia"]),
  T("QAT", "Qatar", "🇶🇦", "B"),
  T("SUI", "Switzerland", "🇨🇭", "B"),
  // Group C
  T("BRA", "Brazil", "🇧🇷", "C"),
  T("MAR", "Morocco", "🇲🇦", "C"),
  T("HAI", "Haiti", "🇭🇹", "C"),
  T("SCO", "Scotland", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "C"),
  // Group D
  T("USA", "USA", "🇺🇸", "D", ["United States", "United States of America"]),
  T("PAR", "Paraguay", "🇵🇾", "D"),
  T("AUS", "Australia", "🇦🇺", "D"),
  T("TUR", "Türkiye", "🇹🇷", "D", ["Turkey", "Turkiye"]),
  // Group E
  T("GER", "Germany", "🇩🇪", "E"),
  T("CUW", "Curaçao", "🇨🇼", "E", ["Curacao"]),
  T("CIV", "Côte d'Ivoire", "🇨🇮", "E", ["Ivory Coast", "Cote d'Ivoire"]),
  T("ECU", "Ecuador", "🇪🇨", "E"),
  // Group F
  T("NED", "Netherlands", "🇳🇱", "F", ["Holland"]),
  T("JPN", "Japan", "🇯🇵", "F"),
  T("SWE", "Sweden", "🇸🇪", "F"),
  T("TUN", "Tunisia", "🇹🇳", "F"),
  // Group G
  T("BEL", "Belgium", "🇧🇪", "G"),
  T("EGY", "Egypt", "🇪🇬", "G"),
  T("IRN", "IR Iran", "🇮🇷", "G", ["Iran", "Iran IR"]),
  T("NZL", "New Zealand", "🇳🇿", "G"),
  // Group H
  T("ESP", "Spain", "🇪🇸", "H"),
  T("URU", "Uruguay", "🇺🇾", "H"),
  T("KSA", "Saudi Arabia", "🇸🇦", "H"),
  T("CPV", "Cabo Verde", "🇨🇻", "H", ["Cape Verde", "Cape Verde Islands"]),
  // Group I
  T("FRA", "France", "🇫🇷", "I"),
  T("SEN", "Senegal", "🇸🇳", "I"),
  T("NOR", "Norway", "🇳🇴", "I"),
  T("IRQ", "Iraq", "🇮🇶", "I"),
  // Group J
  T("ARG", "Argentina", "🇦🇷", "J"),
  T("ALG", "Algeria", "🇩🇿", "J"),
  T("AUT", "Austria", "🇦🇹", "J"),
  T("JOR", "Jordan", "🇯🇴", "J"),
  // Group K
  T("POR", "Portugal", "🇵🇹", "K"),
  T("COL", "Colombia", "🇨🇴", "K"),
  T("UZB", "Uzbekistan", "🇺🇿", "K"),
  T("COD", "Congo DR", "🇨🇩", "K", ["DR Congo", "Congo, Democratic Republic of", "Democratic Republic of the Congo"]),
  // Group L
  T("ENG", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "L"),
  T("CRO", "Croatia", "🇭🇷", "L"),
  T("GHA", "Ghana", "🇬🇭", "L"),
  T("PAN", "Panama", "🇵🇦", "L"),
];

export const TEAM_BY_ID: Record<TeamId, TeamInfo> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t])
);

export const ALL_TEAM_IDS: TeamId[] = TEAMS.map((t) => t.id);

export const GROUPS: Record<GroupLetter, TeamId[]> = TEAMS.reduce(
  (acc, t) => {
    (acc[t.group] ??= []).push(t.id);
    return acc;
  },
  {} as Record<GroupLetter, TeamId[]>
);

/** Lowercased, diacritics-stripped, punctuation-collapsed key. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[.,]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_INDEX = new Map<string, TeamId>();
for (const team of TEAMS) {
  for (const alias of [team.name, team.id, ...team.aliases]) {
    const key = normalizeName(alias);
    const existing = ALIAS_INDEX.get(key);
    if (existing && existing !== team.id) {
      throw new Error(`Alias collision: "${alias}" maps to ${existing} and ${team.id}`);
    }
    ALIAS_INDEX.set(key, team.id);
  }
}

/**
 * Resolve a source-specific team name to a canonical id.
 * Returns null for non-WC2026 teams (callers decide whether that's an error).
 */
export function resolveTeam(name: string): TeamId | null {
  return ALIAS_INDEX.get(normalizeName(name)) ?? null;
}

/** Strict variant: throws when the name should be one of the 48 but isn't known. */
export function resolveTeamOrThrow(name: string): TeamId {
  const id = resolveTeam(name);
  if (!id) throw new Error(`Unknown team name: "${name}"`);
  return id;
}
