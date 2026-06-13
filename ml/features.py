"""Feature engineering: turn the Elo-annotated match history into stacked
per-side training rows, and expose each team's current (as-of-cutoff) state
for the 2026 export.

All strength signals are time-varying (pre-match Elo + decayed form) so the
backtest is leak-free. The rich 2026 signals (market value, FIFA, coach) enter
later, in export.py, as an Elo adjustment — never as constant-per-team training
columns that would leak current strength into past matches.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURES = [
    "strength_diff",
    "value_diff",
    "self_form_gf",
    "self_form_ga",
    "opp_form_gf",
    "opp_form_ga",
    "rest_diff",
    "is_home",
    "is_neutral",
    "importance",
]


def importance(tournament: str, cfg: dict) -> float:
    w = cfg["training"]["importance_weights"]
    t = str(tournament).lower()
    if "qualification" in t:
        return w["qualifier"]
    if t == "fifa world cup":
        return w["fifa_world_cup"]
    if t == "friendly":
        return w["friendly"]
    if "nations league" in t:
        return w["nations_league"]
    continental = (
        "copa america", "uefa euro", "african cup", "africa cup",
        "asian cup", "gold cup", "concacaf", "confederations",
    )
    plain = (
        t.encode("ascii", "ignore").decode()
    )
    if any(c in plain for c in continental):
        return w["continental"]
    return w["other_tournament"]


def _add_form_and_rest(matches: pd.DataFrame, cfg: dict):
    """Single chronological pass computing pre-match decayed form + rest days
    for both sides, plus each team's final state for the export.
    """
    hl = cfg["form"]["form_half_life_days"]
    state: dict[str, dict] = {}  # team -> {last, sgf, sga, sw}

    def pre(team: str, date: pd.Timestamp):
        s = state.get(team)
        if s is None:
            return np.nan, np.nan, 20.0
        gap = (date - s["last"]).days
        factor = 0.5 ** (gap / hl)
        sw = s["sw"] * factor
        if sw <= 1e-9:
            gf = ga = np.nan
        else:
            gf = (s["sgf"] * factor) / sw
            ga = (s["sga"] * factor) / sw
        rest = float(min(max(gap, 0), 20))
        return gf, ga, rest

    def update(team: str, date: pd.Timestamp, gf: int, ga: int):
        s = state.get(team)
        if s is None:
            state[team] = {"last": date, "sgf": float(gf), "sga": float(ga), "sw": 1.0}
            return
        gap = (date - s["last"]).days
        factor = 0.5 ** (gap / hl)
        s["sgf"] = s["sgf"] * factor + gf
        s["sga"] = s["sga"] * factor + ga
        s["sw"] = s["sw"] * factor + 1.0
        s["last"] = date

    n = len(matches)
    fh_gf = np.empty(n); fh_ga = np.empty(n); rh = np.empty(n)
    fa_gf = np.empty(n); fa_ga = np.empty(n); ra = np.empty(n)

    for i, (_, m) in enumerate(matches.iterrows()):
        d = m["date"]
        h, a = m["home_team"], m["away_team"]
        fh_gf[i], fh_ga[i], rh[i] = pre(h, d)
        fa_gf[i], fa_ga[i], ra[i] = pre(a, d)
        update(h, d, int(m["home_score"]), int(m["away_score"]))
        update(a, d, int(m["away_score"]), int(m["home_score"]))

    out = matches.copy()
    out["form_home_gf"], out["form_home_ga"], out["rest_home"] = fh_gf, fh_ga, rh
    out["form_away_gf"], out["form_away_ga"], out["rest_away"] = fa_gf, fa_ga, ra
    return out, state


def _value_diff(df: pd.DataFrame, value_table: dict | None) -> np.ndarray:
    """log(value_home) - log(value_away) as of each match's year (causal)."""
    if value_table is None:
        return np.full(len(df), np.nan)
    from . import ingest  # local import to avoid a cycle at module load
    years = df["date"].dt.year.to_numpy()
    out = np.empty(len(df))
    for i, (h, a, y) in enumerate(zip(df["home_team"], df["away_team"], years)):
        out[i] = ingest.value_as_of(value_table, h, int(y)) - ingest.value_as_of(
            value_table, a, int(y)
        )
    return out


def build_training_frame(matches_with_elo: pd.DataFrame, cfg: dict, value_table=None):
    """Return (stacked_rows_df, final_form_state).

    Stacked rows: two per match (home-side, away-side); label = goals scored by
    the 'self' team; sample weight = time-decay * tournament importance.
    """
    df, final_state = _add_form_and_rest(matches_with_elo, cfg)

    start = pd.Timestamp(cfg["training"]["start_date"])
    cutoff = pd.Timestamp(cfg["training"]["cutoff_date"])
    df = df[(df["date"] >= start) & (df["date"] < cutoff)].copy()

    hl = cfg["training"]["half_life_days"]
    age_days = (cutoff - df["date"]).dt.days.clip(lower=0)
    decay = 0.5 ** (age_days / hl)
    imp = df["tournament"].map(lambda t: importance(t, cfg))
    df["sample_weight"] = decay * imp
    df["importance"] = imp
    df["is_neutral"] = df["neutral"].astype(float)
    df["value_diff"] = _value_diff(df, value_table)

    home = pd.DataFrame({
        "strength_diff": df["elo_home"] - df["elo_away"],
        "value_diff": df["value_diff"],
        "self_form_gf": df["form_home_gf"],
        "self_form_ga": df["form_home_ga"],
        "opp_form_gf": df["form_away_gf"],
        "opp_form_ga": df["form_away_ga"],
        "rest_diff": df["rest_home"] - df["rest_away"],
        "is_home": np.where(df["neutral"], 0.0, 1.0),
        "is_neutral": df["is_neutral"],
        "importance": df["importance"],
        "goals": df["home_score"].astype(float),
        "sample_weight": df["sample_weight"],
    })
    away = pd.DataFrame({
        "strength_diff": df["elo_away"] - df["elo_home"],
        "value_diff": -df["value_diff"],
        "self_form_gf": df["form_away_gf"],
        "self_form_ga": df["form_away_ga"],
        "opp_form_gf": df["form_home_gf"],
        "opp_form_ga": df["form_home_ga"],
        "rest_diff": df["rest_away"] - df["rest_home"],
        "is_home": 0.0,
        "is_neutral": df["is_neutral"],
        "importance": df["importance"],
        "goals": df["away_score"].astype(float),
        "sample_weight": df["sample_weight"],
    })
    stacked = pd.concat([home, away], ignore_index=True)
    stacked = stacked.dropna(subset=["goals"])
    return stacked, final_state


def current_form(final_state: dict, team_raw_name: str, cfg: dict):
    """Decayed form for a team as of cutoff (uses raw match-history name)."""
    s = final_state.get(team_raw_name)
    cutoff = pd.Timestamp(cfg["training"]["cutoff_date"])
    if s is None or s["sw"] <= 1e-9:
        return np.nan, np.nan
    gap = (cutoff - s["last"]).days
    factor = 0.5 ** (gap / cfg["form"]["form_half_life_days"])
    sw = s["sw"] * factor
    if sw <= 1e-9:
        return np.nan, np.nan
    return (s["sgf"] * factor) / sw, (s["sga"] * factor) / sw
