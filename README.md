# World Cup 2026 Predictor

A Next.js app that predicts the outcome of the FIFA World Cup 2026 with a
Monte Carlo simulation, and automatically ingests real results as they happen
to keep the forecast current.

![dashboard](https://img.shields.io/badge/sims-10%2C000-green) ![tests](https://img.shields.io/badge/tests-54%20passing-brightgreen)

## What it does

- **Championship odds dashboard** — each team's probability of reaching the
  Round of 32 → Round of 16 → QF → SF → Final → winning the cup, from 10,000
  full-tournament simulations.
- **Match-by-match predictions** — win/draw/loss probabilities and most-likely
  scorelines for every upcoming fixture; played matches show the real result.
- **What-if simulator** — force any result and the whole tournament
  re-simulates instantly (in a Web Worker) so you can see how the odds shift.
- **Odds over time** — a daily snapshot is saved so you can chart how each
  team's chances evolved through the tournament.

## The model

Team strength blends three signals (z-scored, then mapped back to the Elo
scale, with a 0.8 shrinkage toward the mean for estimate uncertainty):

1. **Elo** computed from ~49,000 historical internationals since 1872
   ([martj42/international_results](https://github.com/martj42/international_results),
   CC0), using the World Football Elo K-factors and a home-advantage bonus that
   only applies to a host nation playing in its own country.
2. **FIFA world ranking** points (latest pre-tournament release).
3. **Squad market value** (Transfermarkt-style totals per squad).

Matches are turned into goals with a **Dixon-Coles bivariate Poisson** model,
and the full bracket — 12 groups, the 2026 head-to-head tiebreakers, the 8
best-third allocation, and the knockout rounds — is simulated 10,000 times with
a seeded PRNG (fully deterministic). Played results are locked in and the Elo
ratings updated forward, so the forecast conditions on what's actually happened.

Calibration: the favourite's title odds (~17%) line up with professional
forecasters (Opta had Spain 16.1%, the Zeileis et al. academic model 14.5%).

## Data sources & auto-update

| Source | Role |
|---|---|
| [fixturedownload.com](https://fixturedownload.com/feed/json/fifa-world-cup-2026) | Primary live fixtures + results (cached 2h) |
| ESPN scoreboard API | Fallback for live scores |
| committed `data/seeds/fixtures-2026.json` | Offline schedule baseline — the app always renders, even with no network |

Results refresh automatically: server pages revalidate every 2 hours, so each
visit re-fetches the latest scores and re-runs the prediction.

## Getting started

```bash
pnpm install
pnpm setup-data   # one-time: download history, compute Elo, fetch rankings + fixtures
pnpm dev          # http://localhost:3000
```

`pnpm setup-data` writes the committed artifacts under `data/seeds/` and
`data/derived/` (Elo ratings, FIFA rankings, the fixture baseline) and prints an
Elo calibration report against eloratings.net. Re-run it any time to refresh the
historical inputs.

## Snapshots (trends)

The Trends page needs at least two daily snapshots. Capture one with:

```bash
pnpm snapshot
```

In production a Vercel cron (`vercel.json`, daily at 07:00 UTC) hits
`/api/cron/snapshot` automatically. Set `CRON_SECRET` and the route requires a
`Bearer` token. **Note:** Vercel's filesystem is read-only, so the bundled
`FsSnapshotStore` can't persist there — either commit snapshots produced by
`pnpm snapshot` locally, or implement a `BlobSnapshotStore`
(`lib/data/snapshots.ts` already defines the `SnapshotStore` interface).

## Tuning

Every model knob lives in [`lib/constants.ts`](lib/constants.ts): simulation
count, blend weights, rating shrinkage, home advantage, the Dixon-Coles ρ, the
Elo K-factors and the goal-mapping base rate. Change one, run `pnpm test`, and
re-check the favourite lands in a plausible band.

## Commands

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm test         # vitest unit + integration tests
pnpm typecheck    # tsc --noEmit
pnpm setup-data   # (re)build seed/derived data
pnpm snapshot     # capture today's odds snapshot
```

## Architecture

- `lib/model/*` — Elo, blend, Dixon-Coles, score sampler (pure, no deps)
- `lib/sim/*` — group tiebreakers, best-thirds allocation, bracket, single-sim
  engine, Monte Carlo aggregation, and the Web Worker entry
- `lib/data/*` — schemas (zod), live fixture merge + ESPN fallback, ratings,
  snapshots
- `lib/names.ts` — canonical team registry resolving every source's spelling
- `app/*` — dashboard, matches, simulator, trends pages + the cron route

The simulation engine (`lib/model`, `lib/sim`) is dependency-free TypeScript so
the exact same code runs on the server (cached) and in the browser Web Worker
for instant what-ifs.
