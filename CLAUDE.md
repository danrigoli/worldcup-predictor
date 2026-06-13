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
```

Node: see `.nvmrc` (22.13.0; engines requires >=22.13.0). Always use **pnpm**.

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

RUNTIME (every request, ~2h cache):
  fixturedownload (UA header + zod) ─┐
  ESPN scoreboard (fallback)        ─┤─► merge live scores onto baseline ─► Match[]
  committed baseline (offline)      ─┘
  seeds + derived ─► blend ─► PRE-tournament ratings ─► Monte Carlo (10k) ─► odds
```

- `lib/model/*` — Elo, blend, Dixon-Coles, score sampler. **Pure, dependency-free.**
- `lib/sim/*` — group tiebreakers, best-thirds allocation, bracket, single-sim
  engine, Monte Carlo aggregation, Web Worker entry. **Pure, dependency-free.**
- `lib/data/*` — zod schemas, live fixture merge + ESPN fallback, ratings, snapshots.
- `lib/names.ts` — canonical team registry (FIFA trigram ids) + cross-source aliases.
- `lib/engine.ts` — ties data + sim together for server pages (cached); re-exports
  the pure `simulate`.
- `app/*` — dashboard (`/`), matches, simulator, trends, `api/cron/snapshot`.

## Load-bearing invariants — don't break these

1. **The sim seeds from PRE-tournament ratings, never effective ratings.**
   `simulate()` / `runSimulation()` take pre-tournament blended ratings; the sim
   itself replays locked (played + overridden) matches with forward Elo. Passing
   `effectiveRatings()` there would double-count played results. `effectiveRatings`
   is only for per-match display predictions (`lib/sim/match-predictions.ts`).

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

## Tuning the model

All knobs live in `lib/constants.ts`: `SIM_COUNT`, `SEED`, `BLEND_WEIGHTS`,
`RATING_SHRINKAGE` (0.8 — regression-to-mean for estimate uncertainty; raise to
spread favourites further, lower to compress), `HOME_ADVANTAGE`, `BASE_LAMBDA`,
`RHO` (Dixon-Coles), `K_FACTORS`. Calibration target: favourite ~17% (Opta had
Spain 16.1%, Zeileis et al. 14.5%); no team >25%.

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
