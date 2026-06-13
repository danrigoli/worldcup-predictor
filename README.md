# World Cup 2026 Predictor

A Next.js + Python app that predicts the outcome of the FIFA World Cup 2026 with
a machine-learning goals model and a Monte Carlo bracket simulation, and
automatically ingests real results as they happen to keep the forecast current.

![sims](https://img.shields.io/badge/sims-10%2C000-green) ![model](https://img.shields.io/badge/model-LightGBM%20Poisson-blue) ![tests](https://img.shields.io/badge/tests-55%20passing-brightgreen)

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
- **Model page** — the backtest (ML vs the Elo baseline, tournament by
  tournament) and the learned per-team ratings (attack, defense, market value).

## The model

A **LightGBM Poisson goals model** (Python, in [`ml/`](ml/)) is trained on
~49,000 historical internationals since 1872
([martj42/international_results](https://github.com/martj42/international_results),
CC0). For every matchup it predicts each side's expected goals from:

- **Elo strength** (World Football Elo K-factors; host bonus only for a host
  nation playing in its own country),
- **historical squad market value** ([dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets)
  player valuations, joined as-of each match — a genuine player-level signal),
- **recent form** (time-decayed), **rest days**, **host** and **importance**.

Training uses exponential time-decay + importance weighting. The model is
**backtested honestly** with expanding-window, tournament-by-tournament RPS
(WC2014 → EURO2024) and **beats the Elo + Dixon-Coles baseline** (≈0.201 vs
0.203, ahead on 5 of 6). FIFA ranking and coach record (the signals without
clean historical coverage) enter each team's effective strength for the export.

The Python pipeline exports a **48×48 matrix of expected goals** for every
matchup. The TypeScript engine turns those into scorelines with a **Dixon-Coles
bivariate Poisson** and simulates the full bracket — 12 groups, the 2026
head-to-head tiebreakers, the 8 best-third allocation, the knockout rounds —
10,000 times with a seeded PRNG (fully deterministic). Played results are locked
in, so the forecast conditions on what's actually happened.

**Calibration:** a temperature on the goal spread is fit against the real
simulation so the favourite's title odds (~16.5%) line up with professional
forecasters (Opta had Spain 16.1%, the Zeileis et al. academic model 14.5%).
Current top of the board: Spain 16.6%, Argentina 14.8%, England 11.5%, France
11.2%. The offline ML artifacts live in [`public/artifacts/`](public/artifacts/).

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

The ML artifacts in `public/artifacts/` are committed, so the app runs out of the
box. To retrain the model (e.g. to fold in new results):

```bash
python3 -m venv ml/.venv && ml/.venv/bin/pip install -r ml/requirements.txt
pnpm ml:all       # train (+backtest) → calibrate → self-check, re-exports artifacts
```

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
pnpm ml:train     # Python: ingest → LightGBM → backtest → export
pnpm ml:calibrate # fit the calibration temperature → *.latest.json
pnpm ml:all       # full ML refresh (train + calibrate + check)
```

## Architecture

- `ml/*` — Python ML pipeline: ingest, features, LightGBM Poisson model,
  temporal-CV backtest, and the artifact export (`ml/teams.py` mirrors
  `lib/names.ts`)
- `public/artifacts/*` — committed ML outputs: the 48×48 λ matrix, team ratings,
  and run metadata the TS engine reads
- `lib/model/*` — Elo, blend, Dixon-Coles, score sampler, the λ-matrix loader
  (pure, no deps)
- `lib/sim/*` — the match-strength model (matrix-primary, Elo-fallback), group
  tiebreakers, best-thirds allocation, bracket, single-sim engine, Monte Carlo
  aggregation, and the Web Worker entry
- `lib/data/*` — schemas (zod), live fixture merge + ESPN fallback, ratings,
  snapshots, ML-artifact loaders
- `lib/names.ts` — canonical team registry resolving every source's spelling
- `app/*` — dashboard, matches, simulator, trends, model pages + the cron route

The simulation engine (`lib/model`, `lib/sim`) is dependency-free TypeScript so
the exact same code runs on the server (cached) and in the browser Web Worker for
instant what-ifs. The ML model runs **offline** in Python; the app only reads its
exported JSON, so predictions stay fast and fully offline-capable.
