"""LightGBM Poisson goals model + Dixon-Coles scoreline math (mirrors
lib/model/dixon-coles.ts) + a leak-free temporal-CV backtest that benchmarks
the GBM against the Elo+Dixon-Coles closed-form baseline on RPS.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor

from . import ingest
from .features import FEATURES, _add_form_and_rest, build_training_frame, importance

MAX_GOALS = 8  # matches lib/constants.ts
GRID = MAX_GOALS + 1
BASE_LAMBDA = 1.35
LAMBDA_PER_ELO = 400.0


def _poisson_row(lam: float) -> np.ndarray:
    row = np.empty(GRID)
    row[0] = np.exp(-lam)
    for k in range(1, GRID):
        row[k] = row[k - 1] * lam / k
    return row


def score_grid(lh: float, la: float, rho: float) -> np.ndarray:
    ph, pa = _poisson_row(lh), _poisson_row(la)
    g = np.outer(ph, pa)
    # Dixon-Coles tau on the four low-score cells.
    g[0, 0] *= 1 - lh * la * rho
    g[0, 1] *= 1 + lh * rho
    g[1, 0] *= 1 + la * rho
    g[1, 1] *= 1 - rho
    return g / g.sum()


def result_probs(lh: float, la: float, rho: float) -> tuple[float, float, float]:
    g = score_grid(lh, la, rho)
    home = np.tril(g, -1).sum()  # h > a
    draw = np.trace(g)
    away = np.triu(g, 1).sum()   # a > h
    return float(home), float(draw), float(away)


def rps(probs: tuple[float, float, float], outcome: int) -> float:
    """Ranked Probability Score for ordered [home, draw, away]. outcome in 0/1/2."""
    obs = [0.0, 0.0, 0.0]
    obs[outcome] = 1.0
    cum_p = cum_o = 0.0
    total = 0.0
    for i in range(2):  # K-1 terms
        cum_p += probs[i]
        cum_o += obs[i]
        total += (cum_p - cum_o) ** 2
    return total / 2.0


def clamp(x, lo, hi):
    return np.minimum(hi, np.maximum(lo, x))


def baseline_lambdas(strength_diff, clamp_lo, clamp_hi):
    lh = clamp(BASE_LAMBDA + strength_diff / LAMBDA_PER_ELO, clamp_lo, clamp_hi)
    la = clamp(BASE_LAMBDA - strength_diff / LAMBDA_PER_ELO, clamp_lo, clamp_hi)
    return lh, la


def train_gbm(train_df: pd.DataFrame, cfg: dict) -> LGBMRegressor:
    m = cfg["model"]
    model = LGBMRegressor(
        objective=m["objective"],
        num_leaves=m["num_leaves"],
        learning_rate=m["learning_rate"],
        n_estimators=m["n_estimators"],
        min_child_samples=m["min_child_samples"],
        subsample=m["subsample"],
        colsample_bytree=m["colsample_bytree"],
        reg_lambda=m.get("reg_lambda", 0.0),
        reg_alpha=m.get("reg_alpha", 0.0),
        max_depth=m.get("max_depth", -1),
        subsample_freq=1,
        verbose=-1,
    )
    model.fit(
        train_df[FEATURES],
        train_df["goals"],
        sample_weight=train_df["sample_weight"],
    )
    return model


def _outcome(hs: float, as_: float) -> int:
    return 0 if hs > as_ else 1 if hs == as_ else 2


# Tournaments to score in the expanding-window backtest (train strictly before).
BACKTEST_TOURNAMENTS = [
    ("WC2014", "2014-06-01", "2014-07-31", "FIFA World Cup"),
    ("EURO2016", "2016-06-01", "2016-07-31", "UEFA Euro"),
    ("WC2018", "2018-06-01", "2018-07-31", "FIFA World Cup"),
    ("EURO2021", "2021-06-01", "2021-07-31", "UEFA Euro"),
    ("WC2022", "2022-11-01", "2022-12-31", "FIFA World Cup"),
    ("EURO2024", "2024-06-01", "2024-07-31", "UEFA Euro"),
]


def backtest(matches_with_elo: pd.DataFrame, cfg: dict) -> dict:
    """Expanding-window, tournament-by-tournament RPS for GBM vs baseline."""
    rho = cfg["dixon_coles_rho"]
    lo, hi = cfg["lambda_clamp"]
    # Causal form/rest for every match, computed once over the full history.
    annotated, _ = _add_form_and_rest(matches_with_elo, cfg)
    value_table = ingest.historical_squad_values(cfg)
    rows = []

    for name, start, end, label in BACKTEST_TOURNAMENTS:
        start_ts, end_ts = pd.Timestamp(start), pd.Timestamp(end)
        test = annotated[
            (annotated["date"] >= start_ts)
            & (annotated["date"] <= end_ts)
            & (annotated["tournament"].str.contains(label.split()[0], case=False))
        ]
        if len(test) < 10:
            continue

        # Train on everything before this tournament.
        train_cfg = {**cfg, "training": {**cfg["training"], "cutoff_date": start}}
        train_df, _ = build_training_frame(matches_with_elo, train_cfg, value_table)
        model = train_gbm(train_df, train_cfg)

        gbm_scores, base_scores = [], []
        for _, mm in test.iterrows():
            sd = mm["elo_home"] - mm["elo_away"]
            imp = importance(mm["tournament"], cfg)
            is_home = 0.0 if mm["neutral"] else 1.0
            yr = int(mm["date"].year)
            vd = ingest.value_as_of(value_table, mm["home_team"], yr) - ingest.value_as_of(
                value_table, mm["away_team"], yr
            )
            # GBM: two side-rows using the match's REAL pre-match form/rest.
            feat = pd.DataFrame([
                {"strength_diff": sd, "value_diff": vd,
                 "self_form_gf": mm["form_home_gf"], "self_form_ga": mm["form_home_ga"],
                 "opp_form_gf": mm["form_away_gf"], "opp_form_ga": mm["form_away_ga"],
                 "rest_diff": mm["rest_home"] - mm["rest_away"], "is_home": is_home,
                 "is_neutral": float(mm["neutral"]), "importance": imp},
                {"strength_diff": -sd, "value_diff": -vd,
                 "self_form_gf": mm["form_away_gf"], "self_form_ga": mm["form_away_ga"],
                 "opp_form_gf": mm["form_home_gf"], "opp_form_ga": mm["form_home_ga"],
                 "rest_diff": mm["rest_away"] - mm["rest_home"], "is_home": 0.0,
                 "is_neutral": float(mm["neutral"]), "importance": imp},
            ])[FEATURES]
            lh, la = clamp(model.predict(feat), lo, hi)
            outcome = _outcome(mm["home_score"], mm["away_score"])
            gbm_scores.append(rps(result_probs(lh, la, rho), outcome))
            blh, bla = baseline_lambdas(sd, lo, hi)
            base_scores.append(rps(result_probs(blh, bla, rho), outcome))

        rows.append({
            "tournament": name,
            "matches": len(test),
            "gbm_rps": float(np.mean(gbm_scores)),
            "baseline_rps": float(np.mean(base_scores)),
        })

    summary = pd.DataFrame(rows)
    overall = {
        "gbm_rps": float(summary["gbm_rps"].mean()) if len(summary) else None,
        "baseline_rps": float(summary["baseline_rps"].mean()) if len(summary) else None,
        "per_tournament": rows,
    }
    overall["beats_baseline"] = (
        overall["gbm_rps"] is not None
        and overall["gbm_rps"] < overall["baseline_rps"]
    )
    return overall
