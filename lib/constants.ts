/**
 * All model knobs live here. Tuning the predictions = editing this file.
 */

/** Monte Carlo iterations for both server renders and the what-if worker. */
export const SIM_COUNT = 10_000;

/** Fixed PRNG seed: identical inputs must always produce identical odds. */
export const SEED = 20260611;

/** Dixon-Coles low-score correlation correction. */
export const RHO = -0.13;

/** Elo bonus when a team plays in its own country (hosts only at WC2026). */
export const HOME_ADVANTAGE = 80;

/** Expected goals for a team at Elo parity on neutral ground. */
export const BASE_LAMBDA = 1.35;

/** Elo-difference points per +1 expected goal. */
export const LAMBDA_PER_ELO = 400;

export const LAMBDA_MIN = 0.3;
export const LAMBDA_MAX = 3.5;

/**
 * Global multiplier on every expected-goals (λ) lookup. WC2026 has run a touch
 * higher-scoring than the model's prior (≈2.9 actual vs ≈2.6 expected over the
 * opening matches), so we nudge goal rates up ~8%. Applied in
 * lib/model/lambda-matrix.ts; the calibration temperature is re-fit with it in
 * effect, so title odds stay in band. Set to 1 to disable.
 */
export const GOALS_MULTIPLIER = 1.08;

/** Score grid covers 0..MAX_GOALS goals per side. */
export const MAX_GOALS = 8;

/** Elo K-factors by match importance (World Football Elo Ratings system). */
export const K_FACTORS = {
  worldCup: 60,
  continentalFinal: 50,
  qualifier: 40,
  tournament: 30,
  friendly: 20,
} as const;

/** Starting rating for teams entering the historical Elo run. */
export const ELO_SEED_RATING = 1500;

/**
 * Strength blend weights (z-scored signals → Elo scale).
 * When a team is missing squad value data, elo/fifa renormalize to 0.75/0.25.
 */
export const BLEND_WEIGHTS = { elo: 0.6, fifa: 0.2, value: 0.2 } as const;

/**
 * Regression-to-mean factor applied to blended ratings. Point estimates of
 * team strength are uncertain, so deviations from the field mean are shrunk
 * ~20%. Calibrated so the favorite's title odds (~17%) match professional
 * forecasters (Opta Spain 16.1%, Zeileis 14.5%) rather than over-concentrating.
 */
export const RATING_SHRINKAGE = 0.8;

/** Live feed revalidation window (seconds) — short so results land fast. */
export const FIXTURES_REVALIDATE = 15;

export const FIXTURE_FEED_URL =
  "https://fixturedownload.com/feed/json/fifa-world-cup-2026";

/** fixturedownload 403s on non-browser user agents. */
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export const ESPN_SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";

/**
 * Lineup-aware match adjustment. When the confirmed XI is published (~30–60 min
 * pre-kickoff), a team fielding less than its strongest XI is penalised in
 * proportion to the squad-market-value shortfall.
 *   penalty = min(CAP, SENSITIVITY * (bestXIValue - fieldedXIValue) / bestXIValue)
 * The weakened side's expected goals drop by `penalty`; the opponent's rise by
 * `penalty * OPP_TRANSFER` (they concede more). Only applied to imminent/live
 * match predictions, not the tournament sim.
 */
export const LINEUP_SENSITIVITY = 0.55;
export const LINEUP_PENALTY_CAP = 0.2;
export const LINEUP_OPP_TRANSFER = 0.5;
/**
 * A "key player" is one worth at least this share of the squad's best-XI market
 * value. Only key players missing from the confirmed XI drive the penalty — so
 * ordinary rotation is ignored, and squad depth is rewarded (a €100M player is
 * a smaller share of a stacked XI than a talisman is of a modest one).
 */
export const LINEUP_STAR_SHARE = 0.1;
/** Pull the XI for upcoming matches kicking off within this many hours. */
export const LINEUP_WINDOW_HOURS = 3;

export const TOURNAMENT_START = "2026-06-11";
