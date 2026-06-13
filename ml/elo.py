"""Running World Football Elo over the full match history.

Produces a pre-match Elo for both teams of every match (the time-varying
strength feature the GBM trains on) plus the final current ratings used to seed
the 2026 export. Mirrors lib/model/elo.ts so TS and Python agree.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class EloConfig:
    k_world_cup: int = 60
    k_continental_final: int = 50
    k_qualifier: int = 40
    k_tournament: int = 30
    k_friendly: int = 20
    home_advantage: int = 80
    seed_rating: int = 1500


_CONTINENTAL = (
    "copa america", "uefa euro", "african cup of nations", "africa cup of nations",
    "afc asian cup", "gold cup", "concacaf championship", "oceania nations cup",
    "ofc nations cup", "confederations cup",
)


def _strip(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def k_factor(tournament: str, cfg: EloConfig) -> int:
    t = str(tournament).lower()
    if "qualification" in t:
        return cfg.k_qualifier
    if t == "fifa world cup":
        return cfg.k_world_cup
    if t == "friendly":
        return cfg.k_friendly
    plain = _strip(t)
    if any(c in plain for c in _CONTINENTAL):
        return cfg.k_continental_final
    return cfg.k_tournament


def expected_score(rating_diff: float) -> float:
    return 1.0 / (1.0 + 10.0 ** (-rating_diff / 400.0))


def g_factor(goal_diff: int) -> float:
    n = abs(int(goal_diff))
    if n <= 1:
        return 1.0
    if n == 2:
        return 1.5
    return (11 + n) / 8.0


def run_elo(matches: pd.DataFrame, cfg: EloConfig) -> pd.DataFrame:
    """Annotate each row with pre-match elo_home / elo_away.

    `matches` must be sorted by date with columns: home_team, away_team,
    home_score, away_score, tournament, neutral (bool).
    Returns the same frame with elo_home, elo_away columns added, plus the
    final ratings accessible via the returned frame's attrs['final_ratings'].
    """
    ratings: dict[str, float] = {}

    def get(team: str) -> float:
        return ratings.get(team, float(cfg.seed_rating))

    elo_home = np.empty(len(matches))
    elo_away = np.empty(len(matches))

    for i, (_, m) in enumerate(matches.iterrows()):
        h, a = m["home_team"], m["away_team"]
        rh, ra = get(h), get(a)
        elo_home[i] = rh
        elo_away[i] = ra
        ha = 0 if m["neutral"] else cfg.home_advantage
        we = expected_score(rh + ha - ra)
        hs, as_ = int(m["home_score"]), int(m["away_score"])
        w = 1.0 if hs > as_ else 0.5 if hs == as_ else 0.0
        k = k_factor(m["tournament"], cfg)
        delta = k * g_factor(hs - as_) * (w - we)
        ratings[h] = rh + delta
        ratings[a] = ra - delta

    out = matches.copy()
    out["elo_home"] = elo_home
    out["elo_away"] = elo_away
    out.attrs["final_ratings"] = dict(ratings)
    return out
