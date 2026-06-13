/**
 * Fit the calibration temperature for the ML λ-matrix against the real bracket
 * simulation so the favorite's title odds match pro forecasters (~16.5%), then
 * write the calibrated artifacts the app imports:
 *   public/artifacts/lambda_matrix.latest.json   (temperatured matrix)
 *   public/artifacts/team_ratings.latest.json    (+ title_prob)
 * and stamp meta.json. Run: pnpm ml:calibrate
 */
import fs from "node:fs";
import path from "node:path";
import { SEED, SIM_COUNT } from "@/lib/constants";
import { applyTemperature, type LambdaMatrix } from "@/lib/model/lambda-matrix";
import { matrixMatchModel } from "@/lib/sim/match-model";
import { runSimulation } from "@/lib/sim/run";
import { ALL_TEAM_IDS } from "@/lib/names";
import type { Match, Ratings } from "@/lib/types";

const ROOT = path.join(__dirname, "..");
const ART = path.join(ROOT, "public", "artifacts");
const TARGET = 0.165; // Opta had Spain 16.1%

function load<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf-8"));
}

function favoriteProb(matrix: LambdaMatrix, matches: Match[], fifaRank: Ratings) {
  const model = matrixMatchModel(matrix);
  const { odds } = runSimulation(matches, fifaRank, fifaRank, {}, SIM_COUNT, SEED, model);
  let best = 0;
  for (const id of ALL_TEAM_IDS) best = Math.max(best, odds[id].winner);
  return { best, odds };
}

function main() {
  const raw = load<LambdaMatrix>("public/artifacts/lambda_matrix.raw.json");
  const fixtures = load<{ matches: Match[] }>("data/seeds/fixtures-2026.json");
  const fifaRank = load<{ points: Ratings }>("data/seeds/fifa-rankings.json").points;

  // Favorite title prob is monotone increasing in temperature → binary search.
  let lo = 0.5;
  let hi = 1.25;
  let best = { t: 1, fav: 0, odds: {} as ReturnType<typeof favoriteProb>["odds"] };
  for (let iter = 0; iter < 12; iter++) {
    const t = (lo + hi) / 2;
    const m = applyTemperature(raw, t);
    const { best: fav, odds } = favoriteProb(m, fixtures.matches, fifaRank);
    console.log(`  T=${t.toFixed(3)} -> favorite ${(fav * 100).toFixed(1)}%`);
    best = { t, fav, odds };
    if (Math.abs(fav - TARGET) < 0.004) break;
    if (fav > TARGET) hi = t;
    else lo = t;
  }

  const calibrated = applyTemperature(raw, best.t);
  fs.writeFileSync(
    path.join(ART, "lambda_matrix.latest.json"),
    JSON.stringify(calibrated, null, 2)
  );

  // team_ratings + title_prob from the final calibrated sim.
  const ratings = load<{ version: string; teams: Record<string, object> }>(
    "public/artifacts/team_ratings.raw.json"
  );
  for (const id of ALL_TEAM_IDS) {
    (ratings.teams[id] as Record<string, unknown>).title_prob =
      Math.round(best.odds[id].winner * 1000) / 1000;
  }
  fs.writeFileSync(
    path.join(ART, "team_ratings.latest.json"),
    JSON.stringify(ratings, null, 2)
  );

  const meta = load<Record<string, unknown>>("public/artifacts/meta.json");
  meta.calibration = {
    temperature: Math.round(best.t * 1000) / 1000,
    favorite_title_prob: Math.round(best.fav * 1000) / 1000,
    target: TARGET,
    sim_count: SIM_COUNT,
  };
  fs.writeFileSync(path.join(ART, "meta.json"), JSON.stringify(meta, null, 2));

  const top = ALL_TEAM_IDS.map((id) => ({ id, p: best.odds[id].winner }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 6);
  console.log(`\nCalibrated temperature: ${best.t.toFixed(3)} (favorite ${(best.fav * 100).toFixed(1)}%)`);
  console.log("Top title odds:");
  for (const t of top) console.log(`  ${t.id}: ${(t.p * 100).toFixed(1)}%`);
  console.log("\nWrote *.latest.json artifacts.");
}

main();
