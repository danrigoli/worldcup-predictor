import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ALL_TEAM_IDS,
  GROUPS,
  resolveTeam,
  TEAMS,
} from "./names";

const ROOT = path.join(__dirname, "..");

describe("team registry", () => {
  it("has exactly 48 teams in 12 groups of 4", () => {
    expect(ALL_TEAM_IDS).toHaveLength(48);
    expect(new Set(ALL_TEAM_IDS).size).toBe(48);
    for (const letter of "ABCDEFGHIJKL") {
      expect(GROUPS[letter as keyof typeof GROUPS]).toHaveLength(4);
    }
  });

  it("resolves every team's own name, id and aliases", () => {
    for (const t of TEAMS) {
      expect(resolveTeam(t.name)).toBe(t.id);
      expect(resolveTeam(t.id)).toBe(t.id);
      for (const alias of t.aliases) expect(resolveTeam(alias)).toBe(t.id);
    }
  });

  it("resolves source-specific spellings", () => {
    // martj42 / eloratings spellings
    expect(resolveTeam("South Korea")).toBe("KOR");
    expect(resolveTeam("Czech Republic")).toBe("CZE");
    expect(resolveTeam("United States")).toBe("USA");
    expect(resolveTeam("Turkey")).toBe("TUR");
    expect(resolveTeam("Ivory Coast")).toBe("CIV");
    expect(resolveTeam("Cape Verde")).toBe("CPV");
    expect(resolveTeam("DR Congo")).toBe("COD");
    expect(resolveTeam("Iran")).toBe("IRN");
    // diacritic-insensitive
    expect(resolveTeam("Turkiye")).toBe("TUR");
    expect(resolveTeam("Curacao")).toBe("CUW");
  });

  it("returns null for non-WC teams", () => {
    expect(resolveTeam("Italy")).toBeNull();
    expect(resolveTeam("Nigeria")).toBeNull();
  });

  it("resolves every team name in every committed seed", () => {
    const fixtures = JSON.parse(
      fs.readFileSync(path.join(ROOT, "data/seeds/fixtures-2026.json"), "utf-8")
    );
    for (const m of fixtures.matches) {
      for (const side of [m.home, m.away]) {
        if (side.kind === "team") {
          expect(ALL_TEAM_IDS).toContain(side.team);
        }
      }
    }

    for (const file of [
      "data/seeds/fifa-rankings.json",
      "data/derived/ratings.json",
    ]) {
      const json = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf-8"));
      const keys = Object.keys(json.points ?? json.ratings);
      for (const id of ALL_TEAM_IDS) expect(keys).toContain(id);
    }
  });
});

describe("source hygiene", () => {
  it("never uses Math.random anywhere in lib/", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
          // Match the actual call, not prose mentions in comments.
          if (/Math\.random\s*\(/.test(fs.readFileSync(full, "utf-8"))) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(path.join(ROOT, "lib"));
    expect(offenders).toEqual([]);
  });
});
