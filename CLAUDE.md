# CLAUDE.md

Guidance for working in this repo. Read this before making changes.

## What this is

A Next.js 14 (App Router) app that predicts the FIFA World Cup 2026 with a
Monte Carlo simulation and auto-ingests live results. Stack: TypeScript (strict),
pnpm, Tailwind + Radix (shadcn-style), zustand, recharts, zod, date-fns, vitest.

## Commands

```bash
pnpm dev          # dev server (port 3000)
pnpm build        # production build
pnpm test         # vitest unit + integration (54 tests)
pnpm test:watch   # watch mode
pnpm typecheck    # tsc --noEmit
pnpm lint         # next lint
pnpm setup-data   # (re)download sources, recompute Elo, write data/seeds + data/derived
pnpm snapshot     # capture today's odds snapshot to data/snapshots/

# ML pipeline (Python; see ml/ and the ML section below)
pnpm ml:train     # ingest → LightGBM Poisson → backtest → export raw artifacts
pnpm ml:backtest  # temporal-CV backtest only (GBM vs Elo+Dixon-Coles baseline)
pnpm ml:calibrate # fit the temperature vs the real sim → write *.latest.json
pnpm ml:check     # invariants on registry + exported matrix
pnpm ml:all       # train + calibrate + check (the full refresh)
```

Node: see `.nvmrc` (22.13.0; engines requires >=22.13.0). Always use **pnpm**.
Python: `ml/.venv` (3.13). `pnpm ml:*` scripts call it directly; create with
`python3 -m venv ml/.venv && ml/.venv/bin/pip install -r ml/requirements.txt`.

After any change to model or sim code, run `pnpm test` AND sanity-check the
favourite's title odds stay ~8–18% (see below).

## Architecture & data flow

```
ONE-TIME (pnpm setup-data):
  martj42 results.csv ─► historical Elo ─► data/derived/ratings.json (committed)
  eloratings.net      ─► calibration report (data/derived/eloratings-check.json)
  inside.fifa.com     ─► data/seeds/fifa-rankings.json (committed)
  fixturedownload     ─► data/seeds/fixtures-2026.json (committed schedule baseline)
  curated             ─► data/seeds/squad-values.json (committed)

ML PIPELINE (Python, offline — pnpm ml:all):
  martj42 results.csv + dcaribou player valuations + FIFA seed
    ─► running Elo + time-decayed form + historical squad value
    ─► LightGBM Poisson goals model (ml/)
    ─► 48×48 (λ_home, λ_away) matrix ─► public/artifacts/lambda_matrix.raw.json
  calibrate-matrix.ts ─► fit temperature vs the real sim ─► *.latest.json (committed)

RUNTIME (every request, ~2h cache):
  fixturedownload (UA header + zod) ─┐
  ESPN scoreboard (fallback)        ─┤─► merge live scores onto baseline ─► Match[]
  committed baseline (offline)      ─┘
  lambda_matrix.latest.json ─► MatchModel ─► Monte Carlo (10k) ─► odds
  (Elo+FIFA+value blend is the FALLBACK strength model if the matrix is absent.)
```

- `lib/model/*` — Elo, blend, Dixon-Coles, score sampler, **lambda-matrix** (loads
  the ML artifact). **Pure, dependency-free.**
- `lib/sim/*` — `match-model` (matrix-primary / Elo-fallback strength), group
  tiebreakers, best-thirds allocation, bracket, single-sim engine, Monte Carlo,
  Web Worker entry. **Pure, dependency-free.**
- `lib/data/*` — zod schemas, live fixture merge + ESPN fallback, ratings,
  snapshots, `ml-artifacts` (loads team_ratings + meta).
- `lib/names.ts` — canonical team registry (FIFA trigram ids) + cross-source aliases.
- `lib/engine.ts` — ties data + sim together for server pages (cached); re-exports
  the pure `simulate`.
- `ml/*` — the Python pipeline. `ml/teams.py` MUST mirror `lib/names.ts` aliases.
- `app/*` — dashboard (`/`), matches, simulator, trends, **model**, `api/cron/snapshot`.

## Load-bearing invariants — don't break these

1. **The ML λ-matrix is the strength model; the sim does NOT drift strength
   within a tournament.** `lib/sim/match-model.ts` looks up (λ_home, λ_away) per
   matchup from `public/artifacts/lambda_matrix.latest.json` (Elo→λ formula is the
   fallback). Played/overridden matches are *locked* (they condition standings and
   the bracket), but a team's strength is static per run — to fold live results
   into strength, re-run `pnpm ml:all` with a later cutoff. Do NOT reintroduce a
   within-sim forward-Elo update expecting it to change λ.

2. **`lib/model/*` and `lib/sim/*` must stay free of `next/*` and the data layer.**
   They bundle into a Web Worker (`lib/sim/worker.ts`). Importing `next/cache`,
   `fetch`-with-`next`-options, or `fs` into them breaks the worker build. The
   pure entry the worker uses is `lib/sim/run.ts` — keep its import graph clean.

3. **No `Math.random` anywhere in `lib/`.** All randomness goes through
   `mulberry32` in `lib/rng.ts` (seeded → deterministic, reproducible what-ifs).
   `lib/names.test.ts` enforces this with a source grep.

4. **Every external team name resolves through `resolveTeam` (`lib/names.ts`).**
   Aliases are pinned to exact source spellings ("Korea Republic"/"South Korea"/
   "USA"/"United States"/"Türkiye"/"Côte d'Ivoire"/"Cabo Verde"/"Congo DR"…).
   `setup-data` throws loudly on an unresolved name — that's how the alias table
   stays complete. Tests assert no alias collisions and that every seed name resolves.

5. **2026 group tiebreakers are head-to-head FIRST** (points → H2H pts/GD/GF among
   tied → overall GD/GF → FIFA ranking). The recursion in
   `lib/sim/groups.ts#rankByHeadToHead` (a tie that partially splits re-runs H2H on
   the smaller subset) is the highest-risk logic — change it only with the
   `groups.test.ts` cases green.

6. **Best-thirds R32 allocation comes from the feed's placeholder pools**
   (`"3ABCDF"`), solved as a bipartite matching in `lib/sim/thirds.ts` — never
   hand-maintain FIFA's allocation table.

7. **Home advantage applies only to a host (USA/MEX/CAN) playing in its own
   country.** `lib/data/venues.ts#netHomeAdvantage` returns the net (home − away)
   bonus; don't add HA elsewhere.

## ML pipeline (`ml/`)

Python package (`wc_ml`) that learns the goals model and exports the offline
artifacts the TS engine consumes. Knobs live in `ml/config.yaml`.

- **Model**: a single LightGBM Poisson regressor over stacked per-side rows
  (`ml/model.py`). Features (`ml/features.py#FEATURES`): Elo strength diff,
  **historical squad market-value diff** (dcaribou valuations, as-of match year —
  causal), time-decayed form, rest, host, neutral, importance. Sample weights =
  time-decay × tournament importance.
- **Honest backtest** (`ml/model.py#backtest`): expanding-window, tournament-by-
  tournament RPS vs the Elo+Dixon-Coles baseline (WC2014…EURO2024). Current:
  GBM ~0.201 vs baseline ~0.203 — beats it on 5/6. Recorded in `meta.json`.
- **Rich 2026 signals**: market value is a *trained* feature; FIFA rank + coach
  record (`ml/seeds/coaches_2026.csv`, optional) enter the per-team effective
  strength blend in `ml/export.py` (no clean historical coverage to train on).
- **Calibration**: `scripts/calibrate-matrix.ts` binary-searches a temperature on
  the λ spread, running the *real* TS sim each step, until the favourite hits
  ~16.5% (Opta band). The fitted T is baked into `lambda_matrix.latest.json`.
- **Artifacts** (committed under `public/artifacts/`): `lambda_matrix.latest.json`
  (48×48 neutral λ + `host_boost` + `dc_rho` + `temperature`), `team_ratings.latest.json`
  (attack/defense/elo/market value/title_prob), `meta.json`. `.raw.json` = pre-calibration.
- **TS contract**: `lib/model/lambda-matrix.ts` loads the matrix; `dc_rho` must
  equal `RHO` and `lambda_clamp` must equal `LAMBDA_MIN/MAX` in `lib/constants.ts`.
  `ml/teams.py` must mirror `lib/names.ts` aliases (selfcheck + setup-data enforce).
- **Retrain** (e.g. each matchday to fold results into strength): `pnpm ml:all`,
  then commit `public/artifacts/*.latest.json`.

## Tuning the model

The ML λ-matrix is primary; these knobs affect the **fallback** Elo path and the
sampler/grid shared by both: `lib/constants.ts` — `SIM_COUNT`, `SEED`,
`BLEND_WEIGHTS`, `RATING_SHRINKAGE`, `HOME_ADVANTAGE`, `BASE_LAMBDA`, `RHO`
(must match `ml/config.yaml dixon_coles_rho`), `K_FACTORS`. The ML model's own
knobs are in `ml/config.yaml`; the calibration target (favourite ~16.5%) is in
`scripts/calibrate-matrix.ts`. Sanity band: favourite ~15–18%, no team >25%.

## Snapshots / trends

Trends needs ≥2 daily snapshots in `data/snapshots/` (gitignored). Locally:
`pnpm snapshot`. In prod: Vercel cron hits `/api/cron/snapshot` (Bearer
`CRON_SECRET`). **Vercel FS is read-only** — `FsSnapshotStore` can't persist
there; commit local snapshots or add a `BlobSnapshotStore` (the `SnapshotStore`
interface is in `lib/data/snapshots.ts`).

## Gotchas

- `data/raw/` and `data/snapshots/` are gitignored; `data/seeds/` and
  `data/derived/` are committed. A fresh clone runs offline on the model side; run
  `pnpm setup-data` to refresh inputs.
- fixturedownload **403s without a browser User-Agent** — `BROWSER_UA` in constants.
- The fixture feed marks knockout sides as `"To be announced"`; the R16→Final
  bracket structure is pinned in `scripts/setup-data.ts` (`KNOCKOUT_PROGRESSION`),
  cross-checked against openfootball.
- ESPN and the FIFA ranking API are unofficial/undocumented — keep them as
  fallback/seed only, behind zod parsing that fails soft.
