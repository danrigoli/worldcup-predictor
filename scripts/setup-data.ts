/**
 * One-time data pipeline (rerunnable): downloads raw sources, computes
 * historical Elo, and writes the committed seed/derived artifacts the app
 * uses at runtime. Run with: pnpm setup-data
 *
 * Artifacts:
 *   data/derived/ratings.json        pre-tournament Elo for the 48 teams
 *   data/derived/eloratings-check.json  calibration vs eloratings.net
 *   data/seeds/fifa-rankings.json    latest FIFA ranking points
 *   data/seeds/fixtures-2026.json    full 104-match canonical schedule
 *   test/fixtures/*                  pinned samples for unit tests
 */
import fs from "node:fs";
import path from "node:path";
import {
  BROWSER_UA,
  FIXTURE_FEED_URL,
  HOME_ADVANTAGE,
  TOURNAMENT_START,
} from "../lib/constants";
import {
  runHistory,
  type HistoricalMatch,
} from "../lib/model/elo";
import {
  ALL_TEAM_IDS,
  TEAM_BY_ID,
  resolveTeam,
  resolveTeamOrThrow,
} from "../lib/names";
import { parseSlot } from "../lib/data/placeholders";
import {
  hostCountryForVenue,
  hostCountryForVenueOrNull,
} from "../lib/data/venues";
import {
  fixtureFeedSchema,
  fixturesSeedSchema,
  type FixtureRow,
} from "../lib/data/schemas";
import type { Match, Slot, Stage } from "../lib/types";

const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "data", "raw");
const SEEDS = path.join(ROOT, "data", "seeds");
const DERIVED = path.join(ROOT, "data", "derived");
const TEST_FIXTURES = path.join(ROOT, "test", "fixtures");

const RESULTS_CSV_URL =
  "https://raw.githubusercontent.com/martj42/international_results/master/results.csv";
const SHOOTOUTS_CSV_URL =
  "https://raw.githubusercontent.com/martj42/international_results/master/shootouts.csv";
const ELO_WORLD_URL = "https://www.eloratings.net/World.tsv";
const ELO_TEAMS_URL = "https://www.eloratings.net/en.teams.tsv";
const FIFA_PAGE_URL = "https://inside.fifa.com/fifa-world-ranking/men";
const FIFA_API_URL = "https://inside.fifa.com/api/ranking-overview";

/**
 * Official R16→Final progression (FIFA match schedule; cross-checked against
 * openfootball/worldcup.json). The live feed lists these as "To be announced"
 * until teams are known, so the bracket structure is pinned here.
 */
const KNOCKOUT_PROGRESSION: Record<
  number,
  { home: Slot; away: Slot }
> = {
  89: { home: w(74), away: w(77) },
  90: { home: w(73), away: w(75) },
  91: { home: w(76), away: w(78) },
  92: { home: w(79), away: w(80) },
  93: { home: w(83), away: w(84) },
  94: { home: w(81), away: w(82) },
  95: { home: w(86), away: w(88) },
  96: { home: w(85), away: w(87) },
  97: { home: w(89), away: w(90) },
  98: { home: w(93), away: w(94) },
  99: { home: w(91), away: w(92) },
  100: { home: w(95), away: w(96) },
  101: { home: w(97), away: w(98) },
  102: { home: w(99), away: w(100) },
  103: { home: l(101), away: l(102) },
  104: { home: w(101), away: w(102) },
};

function w(matchNumber: number): Slot {
  return { kind: "match-winner", matchNumber };
}
function l(matchNumber: number): Slot {
  return { kind: "match-loser", matchNumber };
}

async function download(url: string, dest: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const body = await res.text();
  fs.writeFileSync(dest, body);
  console.log(`  ✓ ${path.relative(ROOT, dest)} (${(body.length / 1024).toFixed(0)} kB)`);
  return body;
}

/** Minimal RFC-4180 CSV parser (handles quoted fields with commas). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

async function buildHistoricalRatings(): Promise<void> {
  console.log("\n[1/4] Historical Elo from martj42/international_results");
  const csv = await download(RESULTS_CSV_URL, path.join(RAW, "results.csv"));
  await download(SHOOTOUTS_CSV_URL, path.join(RAW, "shootouts.csv"));

  const rows = parseCsv(csv);
  const header = rows[0];
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`results.csv missing column ${name}`);
    return i;
  };
  const cDate = idx("date");
  const cHome = idx("home_team");
  const cAway = idx("away_team");
  const cHs = idx("home_score");
  const cAs = idx("away_score");
  const cTournament = idx("tournament");
  const cNeutral = idx("neutral");

  const matches: HistoricalMatch[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const date = r[cDate];
    if (!date || date >= TOURNAMENT_START) continue; // pre-tournament cutoff
    const hs = parseInt(r[cHs], 10);
    const as = parseInt(r[cAs], 10);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue; // NA fixtures
    matches.push({
      date,
      home: r[cHome],
      away: r[cAway],
      homeScore: hs,
      awayScore: as,
      tournament: r[cTournament],
      neutral: r[cNeutral] === "TRUE",
    });
  }
  matches.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  console.log(`  parsed ${matches.length} historical matches (cutoff ${TOURNAMENT_START})`);

  const table = runHistory(matches, HOME_ADVANTAGE);

  const ratings: Record<string, number> = {};
  const matchCounts: Record<string, number> = {};
  const missing: string[] = [];
  for (const [rawName, entry] of table) {
    const id = resolveTeam(rawName);
    if (id && ALL_TEAM_IDS.includes(id)) {
      // Keep the entry with more matches if two raw names map to one id.
      if (!(id in matchCounts) || entry.matches > matchCounts[id]) {
        ratings[id] = Math.round(entry.rating * 100) / 100;
        matchCounts[id] = entry.matches;
      }
    }
  }
  for (const id of ALL_TEAM_IDS) {
    if (!(id in ratings)) missing.push(id);
  }
  if (missing.length > 0) {
    throw new Error(
      `No historical Elo for: ${missing.join(", ")} — add martj42 aliases to lib/names.ts`
    );
  }

  const out = {
    generatedThrough: TOURNAMENT_START,
    homeAdvantage: HOME_ADVANTAGE,
    ratings,
    matchCounts,
  };
  fs.writeFileSync(
    path.join(DERIVED, "ratings.json"),
    JSON.stringify(out, null, 2)
  );
  console.log(`  ✓ data/derived/ratings.json (48 teams)`);

  // Pin a small sample of the CSV for parser tests.
  const sample = rows.slice(0, 1).concat(rows.slice(1, 40));
  fs.writeFileSync(
    path.join(TEST_FIXTURES, "results-sample.csv"),
    sample.map((r) => r.join(",")).join("\n")
  );
}

async function calibrateAgainstEloratings(): Promise<void> {
  console.log("\n[2/4] Calibration vs eloratings.net");
  const worldTsv = await download(ELO_WORLD_URL, path.join(RAW, "eloratings-world.tsv"));
  const teamsTsv = await download(ELO_TEAMS_URL, path.join(RAW, "eloratings-teams.tsv"));

  const codeToName = new Map<string, string>();
  for (const line of teamsTsv.split("\n")) {
    const parts = line.split("\t");
    if (parts.length >= 2 && parts[0] && !parts[0].endsWith("_loc")) {
      codeToName.set(parts[0], parts[1]);
    }
  }

  const theirRatings: Record<string, number> = {};
  for (const line of worldTsv.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const name = codeToName.get(parts[2]);
    const rating = parseInt(parts[3], 10);
    if (!name || !Number.isFinite(rating)) continue;
    const id = resolveTeam(name);
    if (id) theirRatings[id] = rating;
  }

  const ours = JSON.parse(
    fs.readFileSync(path.join(DERIVED, "ratings.json"), "utf-8")
  ).ratings as Record<string, number>;

  const comparison: Record<
    string,
    { ours: number; theirs: number | null; diff: number | null }
  > = {};
  const diffs: number[] = [];
  let n = 0;
  for (const id of ALL_TEAM_IDS) {
    const theirs = theirRatings[id] ?? null;
    const diff = theirs === null ? null : Math.round(ours[id] - theirs);
    comparison[id] = { ours: Math.round(ours[id]), theirs, diff };
    if (diff !== null) {
      diffs.push(diff);
      n++;
    }
  }
  // Two Elo systems with different absolute baselines differ by a roughly
  // constant offset. Predictions depend only on rating DIFFERENCES, so the
  // meaningful calibration metric is the offset-corrected (de-meaned) spread,
  // not the raw offset.
  const meanOffset = Math.round(diffs.reduce((a, b) => a + b, 0) / n);
  const meanAbsDiff = Math.round(
    diffs.reduce((a, b) => a + Math.abs(b - meanOffset), 0) / n
  );
  fs.writeFileSync(
    path.join(DERIVED, "eloratings-check.json"),
    JSON.stringify(
      { meanOffset, offsetCorrectedMeanAbsDiff: meanAbsDiff, teamsCompared: n, comparison },
      null,
      2
    )
  );
  console.log(
    `  compared ${n}/48 teams; offset ${meanOffset >= 0 ? "+" : ""}${meanOffset}, ` +
      `offset-corrected mean |diff| = ${meanAbsDiff} Elo points`
  );
  if (meanAbsDiff > 50) {
    console.warn(
      `  ⚠ offset-corrected mean abs diff ${meanAbsDiff} > 50 — check K-factor mapping / HA`
    );
  }
  fs.writeFileSync(
    path.join(TEST_FIXTURES, "eloratings-sample.tsv"),
    worldTsv.split("\n").slice(0, 12).join("\n")
  );
}

async function fetchFifaRankings(): Promise<void> {
  console.log("\n[3/4] FIFA rankings");
  const html = await download(FIFA_PAGE_URL, path.join(RAW, "fifa-ranking-page.html"));
  const entries: Array<{ id: string; iso: string }> = [];
  const re = /\{"id":"(id\d+)","iso":"([0-9T:.Z-]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) entries.push({ id: m[1], iso: m[2] });
  if (entries.length === 0) throw new Error("No dateIds found in FIFA ranking page");
  entries.sort((a, b) => (a.iso < b.iso ? -1 : 1));
  const latest = entries[entries.length - 1];
  console.log(`  latest release: ${latest.id} (${latest.iso.slice(0, 10)})`);

  const res = await fetch(`${FIFA_API_URL}?locale=en&dateId=${latest.id}`, {
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!res.ok) throw new Error(`FIFA API → ${res.status}`);
  const json = (await res.json()) as {
    rankings: Array<{
      rankingItem: { countryCode: string; totalPoints: number; name: string };
    }>;
  };
  if (!json.rankings?.length) throw new Error("FIFA API returned empty rankings");

  const points: Record<string, number> = {};
  for (const r of json.rankings) {
    const code = r.rankingItem.countryCode;
    if (ALL_TEAM_IDS.includes(code)) points[code] = r.rankingItem.totalPoints;
    else {
      const id = resolveTeam(r.rankingItem.name);
      if (id) points[id] = r.rankingItem.totalPoints;
    }
  }
  const missing = ALL_TEAM_IDS.filter((id) => !(id in points));
  if (missing.length > 0) {
    throw new Error(`FIFA points missing for: ${missing.join(", ")}`);
  }
  fs.writeFileSync(
    path.join(SEEDS, "fifa-rankings.json"),
    JSON.stringify(
      { asOf: latest.iso.slice(0, 10), dateId: latest.id, points },
      null,
      2
    )
  );
  console.log("  ✓ data/seeds/fifa-rankings.json (48 teams)");
}

function rowToMatch(row: FixtureRow): Match {
  const stage: Stage =
    row.RoundNumber <= 3
      ? "group"
      : row.RoundNumber === 4
        ? "r32"
        : row.RoundNumber === 5
          ? "r16"
          : row.RoundNumber === 6
            ? "qf"
            : row.RoundNumber === 7
              ? "sf"
              : row.MatchNumber === 103
                ? "third-place"
                : "final";

  if (hostCountryForVenueOrNull(row.Location) === null) {
    throw new Error(
      `Match ${row.MatchNumber}: unrecognized venue "${row.Location}" — add it to lib/data/venues.ts`
    );
  }

  const progression = KNOCKOUT_PROGRESSION[row.MatchNumber];
  const home = parseSlot(row.HomeTeam) ?? progression?.home;
  const away = parseSlot(row.AwayTeam) ?? progression?.away;
  if (!home || !away) {
    throw new Error(
      `Match ${row.MatchNumber}: cannot resolve slots "${row.HomeTeam}" / "${row.AwayTeam}"`
    );
  }
  if (stage === "group" && (home.kind !== "team" || away.kind !== "team")) {
    throw new Error(`Match ${row.MatchNumber}: group match with placeholder side`);
  }

  return {
    matchNumber: row.MatchNumber,
    stage,
    group: row.Group ? (row.Group.replace("Group ", "") as Match["group"]) : null,
    dateUtc: row.DateUtc,
    venue: row.Location,
    hostCountry: hostCountryForVenue(row.Location),
    home,
    away,
    homeScore: row.HomeTeamScore,
    awayScore: row.AwayTeamScore,
    winner: row.Winner ? resolveTeam(row.Winner) : null,
  };
}

async function buildFixturesSeed(): Promise<void> {
  console.log("\n[4/4] Fixtures seed from fixturedownload");
  const body = await download(
    FIXTURE_FEED_URL,
    path.join(RAW, "fixtures-feed.json")
  );
  const rows = fixtureFeedSchema.parse(JSON.parse(body));
  const matches = rows
    .map(rowToMatch)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  const seed = { capturedAt: new Date().toISOString(), matches };
  fixturesSeedSchema.parse(seed); // self-check before committing
  fs.writeFileSync(
    path.join(SEEDS, "fixtures-2026.json"),
    JSON.stringify(seed, null, 2)
  );
  const played = matches.filter((mm) => mm.homeScore !== null).length;
  console.log(`  ✓ data/seeds/fixtures-2026.json (104 matches, ${played} played)`);

  fs.writeFileSync(
    path.join(TEST_FIXTURES, "fixturedownload-sample.json"),
    JSON.stringify(rows.slice(0, 6).concat(rows.slice(72, 88)), null, 2)
  );

  // Sanity: every WC team appears in exactly 3 group matches.
  const counts = new Map<string, number>();
  for (const mm of matches) {
    if (mm.stage !== "group") continue;
    for (const side of [mm.home, mm.away]) {
      if (side.kind === "team") {
        counts.set(side.team, (counts.get(side.team) ?? 0) + 1);
      }
    }
  }
  for (const id of ALL_TEAM_IDS) {
    if (counts.get(id) !== 3) {
      throw new Error(
        `${id} (${TEAM_BY_ID[id].name}) appears in ${counts.get(id) ?? 0} group matches, expected 3`
      );
    }
  }
  console.log("  ✓ sanity: all 48 teams have exactly 3 group matches");
}

async function main() {
  for (const dir of [RAW, SEEDS, DERIVED, TEST_FIXTURES]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await buildHistoricalRatings();
  await calibrateAgainstEloratings();
  await fetchFifaRankings();
  await buildFixturesSeed();

  // ESPN sample for the fallback parser tests (non-fatal if unavailable).
  try {
    const espn = await download(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611",
      path.join(TEST_FIXTURES, "espn-sample.json")
    );
    JSON.parse(espn);
  } catch (e) {
    console.warn(`  ⚠ ESPN sample fetch failed (fallback tests will skip): ${e}`);
  }

  console.log("\nDone. Review the calibration report and commit data/seeds + data/derived.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
