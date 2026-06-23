"""Build the offline artifacts the TS Monte Carlo consumes.

Produces a RAW (uncalibrated, temperature=1) 48x48 lambda matrix plus per-team
ratings and run metadata. The TS step scripts/calibrate-matrix.ts then fits the
temperature against the real bracket sim and writes the *.latest.json files.

Effective team strength = current Elo blended with the rich 2026 signals
(FIFA points, squad market value, coach record). The GBM maps that strength +
current form + context to expected goals for every ordered pair.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import ingest, teams
from .features import FEATURES, current_form
from .model import clamp

REPO = Path(__file__).resolve().parents[1]


def _znorm(values: dict[str, float]) -> dict[str, float]:
    arr = np.array([v for v in values.values() if v is not None and np.isfinite(v)])
    if len(arr) == 0:
        return {k: 0.0 for k in values}
    mean, sd = arr.mean(), arr.std()
    if sd <= 1e-9:
        return {k: 0.0 for k in values}
    return {
        k: ((v - mean) / sd if (v is not None and np.isfinite(v)) else 0.0)
        for k, v in values.items()
    }


def _elo_lookup(final_ratings: dict[str, float]) -> dict[str, float]:
    norm = {teams.normalize(k): v for k, v in final_ratings.items()}
    out = {}
    for tid, team in teams.TEAMS.items():
        for cand in (team.name, *team.aliases, team.id):
            key = teams.normalize(cand)
            if key in norm:
                out[tid] = norm[key]
                break
        else:
            out[tid] = float("nan")
    return out


def effective_strength(cfg, final_ratings, squad, coaches):
    """Per-team effective Elo-scale strength from the rich signals blend."""
    elo = _elo_lookup(final_ratings)
    fifa = ingest.load_fifa_points(cfg)

    sval = {t: float(squad.loc[t, "squad_value_eur"]) if t in squad.index else np.nan
            for t in teams.ALL_TEAM_IDS}
    log_val = {t: (np.log(v) if (np.isfinite(v) and v > 0) else np.nan)
               for t, v in sval.items()}

    # Coach signal = a composite of win %, prior-WC experience and (capped)
    # tenure, each z-scored across the 48 teams then weighted and re-normalized.
    if len(coaches) and "coach_win_pct" in coaches.columns:
        cap = cfg.get("coach_tenure_cap_days", 1095)

        def col(name, default=np.nan):
            return {
                t: (coaches.loc[t, name] if t in coaches.index else default)
                for t in teams.ALL_TEAM_IDS
            }

        win = col("coach_win_pct")
        prior = {t: (v if np.isfinite(v) else 0.0) for t, v in col("coach_prior_wc", 0.0).items()}
        tenure = {
            t: (min(float(v), cap) if np.isfinite(v) else np.nan)
            for t, v in col("coach_tenure_days").items()
        }
        cw = cfg["coach_weights"]
        z_win, z_prior, z_ten = _znorm(win), _znorm(prior), _znorm(tenure)
        composite = {
            t: cw["win_pct"] * z_win[t]
            + cw["prior_wc"] * z_prior[t]
            + cw["tenure"] * z_ten[t]
            for t in teams.ALL_TEAM_IDS
        }
        has_coach = any(np.isfinite(v) for v in win.values())
    else:
        composite = {t: 0.0 for t in teams.ALL_TEAM_IDS}
        has_coach = False

    z_elo = _znorm(elo)
    z_fifa = _znorm({t: fifa.get(t, np.nan) for t in teams.ALL_TEAM_IDS})
    z_coach = _znorm(composite)  # re-normalize the composite to unit variance

    w = dict(cfg["strength_blend"])  # elo, fifa, coach (market value is a feature)
    if not has_coach:
        drop = w.pop("coach")
        tot = sum(w.values())
        for k in w:
            w[k] += drop * w[k] / tot
        w["coach"] = 0.0

    elo_arr = np.array([v for v in elo.values() if np.isfinite(v)])
    elo_mean, elo_sd = elo_arr.mean(), elo_arr.std()

    strength = {}
    for t in teams.ALL_TEAM_IDS:
        z = w["elo"] * z_elo[t] + w["fifa"] * z_fifa[t] + w["coach"] * z_coach[t]
        strength[t] = elo_mean + z * elo_sd
    # current log squad value per team (for the GBM value_diff feature + display)
    return strength, elo, sval, log_val


def build_matrix(model, cfg, strength, log_val, final_state):
    lo, hi = cfg["lambda_clamp"]
    ids = teams.ALL_TEAM_IDS
    form = {}
    for t in ids:
        team = teams.TEAMS[t]
        gf = ga = np.nan
        for cand in (team.name, *team.aliases):
            r = current_form(final_state, cand, cfg)
            if np.isfinite(r[0]):
                gf, ga = r
                break
        form[t] = (gf, ga)

    def lv(t):
        v = log_val.get(t, np.nan)
        return v if np.isfinite(v) else np.nan

    # L[i][j] = expected goals for i (self) vs j (opp) at a neutral venue.
    rows = []
    index = []
    for i in ids:
        for j in ids:
            if i == j:
                continue
            index.append((i, j))
            rows.append({
                "strength_diff": strength[i] - strength[j],
                "value_diff": lv(i) - lv(j),
                "self_form_gf": form[i][0], "self_form_ga": form[i][1],
                "opp_form_gf": form[j][0], "opp_form_ga": form[j][1],
                "rest_diff": 0.0, "is_home": 0.0, "is_neutral": 1.0,
                "importance": 1.0,
            })
    X = pd.DataFrame(rows)[FEATURES]
    pred = clamp(model.predict(X), lo, hi)
    L = {t: {} for t in ids}
    for (i, j), lam in zip(index, pred):
        L[i][j] = float(lam)

    # host_boost: mean log-lift of is_home=1 vs 0 over all pairs, dampened for
    # three-country shared hosting.
    X_home = X.copy()
    X_home["is_home"] = 1.0
    X_home["is_neutral"] = 0.0
    pred_home = clamp(model.predict(X_home), lo, hi)
    host_boost = float(np.mean(np.log(pred_home) - np.log(pred))) * 0.7

    neutral = {i: {} for i in ids}
    for i in ids:
        for j in ids:
            if i == j:
                continue
            neutral[i][j] = [round(L[i][j], 2), round(L[j][i], 2)]

    return neutral, round(host_boost, 4), L, form


def attack_defense(L, ids):
    all_vals = [L[i][j] for i in ids for j in ids if i != j]
    gmean = float(np.mean(all_vals))
    ratings = {}
    for t in ids:
        scored = np.mean([L[t][j] for j in ids if j != t])
        conceded = np.mean([L[j][t] for j in ids if j != t])
        ratings[t] = {
            "attack": round(float(scored) / gmean, 3),
            "defense": round(gmean / float(conceded), 3),
        }
    return ratings


def write_artifacts(cfg, model, final_ratings_state, backtest_result):
    final_ratings, final_state = final_ratings_state
    squad = ingest.load_squad_features(cfg)
    coaches = ingest.load_coaches(cfg)
    strength_map, elo, sval, log_val = effective_strength(
        cfg, final_ratings, squad, coaches
    )

    neutral, host_boost, L, _form = build_matrix(
        model, cfg, strength_map, log_val, final_state
    )
    ad = attack_defense(L, teams.ALL_TEAM_IDS)

    version = pd.Timestamp(cfg["training"]["cutoff_date"]).strftime("%Y-%m-%d")
    out_dir = REPO / cfg["paths"]["artifacts_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)

    matrix = {
        "version": version,
        "teams": teams.ALL_TEAM_IDS,
        "neutral": neutral,
        "host_boost": host_boost,
        "dc_rho": cfg["dixon_coles_rho"],
        "temperature": 1.0,  # raw; calibrate-matrix.ts bakes in the fitted value
        "lambda_clamp": cfg["lambda_clamp"],
    }
    (out_dir / "lambda_matrix.raw.json").write_text(json.dumps(matrix, indent=2))

    ratings = {"version": version, "teams": {}}
    for t in teams.ALL_TEAM_IDS:
        ratings["teams"][t] = {
            **ad[t],
            "elo": round(float(elo[t]), 1) if np.isfinite(elo[t]) else None,
            "strength": round(float(strength_map[t]), 1),
            "market_value_m": round(sval[t] / 1e6, 1) if np.isfinite(sval[t]) else None,
        }
    (out_dir / "team_ratings.raw.json").write_text(json.dumps(ratings, indent=2))

    meta = {
        "version": version,
        "training_cutoff": cfg["training"]["cutoff_date"],
        "training_start": cfg["training"]["start_date"],
        "half_life_days": cfg["training"]["half_life_days"],
        "features": FEATURES,
        "strength_blend": cfg["strength_blend"],
        "host_boost": host_boost,
        "backtest": backtest_result,
        "calibration": {"temperature": None, "note": "filled by calibrate-matrix.ts"},
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"  wrote raw artifacts to {out_dir.relative_to(REPO)}")
    return matrix, ratings, meta
