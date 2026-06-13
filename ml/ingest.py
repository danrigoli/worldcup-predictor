"""Load + normalize every data source the pipeline needs.

Reuses the already-downloaded data/raw/results.csv (from `pnpm setup-data`),
the committed FIFA ranking seed, the dcaribou player dump, and the curated
coach / host-city / market-consensus seeds. Everything keyed to the 48 FIFA
trigrams via teams.resolve.
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

from . import teams

REPO = Path(__file__).resolve().parents[1]
R2 = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
PLAYERS_URL = f"{R2}/players.csv.gz"
VALUATIONS_URL = f"{R2}/player_valuations.csv.gz"


def _p(rel: str) -> Path:
    return REPO / rel


def load_results(cfg: dict) -> pd.DataFrame:
    """Historical internationals with parseable scores, sorted by date."""
    df = pd.read_csv(_p(cfg["paths"]["results_csv"]))
    df = df[df["home_score"].notna() & df["away_score"].notna()].copy()
    df = df[(df["home_score"] != "NA") & (df["away_score"] != "NA")]
    df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
    df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
    df = df.dropna(subset=["home_score", "away_score"])
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df["neutral"] = df["neutral"].astype(str).str.upper().eq("TRUE")
    df = df.sort_values("date").reset_index(drop=True)
    return df


def load_fifa_points(cfg: dict) -> dict[str, float]:
    raw = json.loads(_p(cfg["paths"]["fifa_rankings"]).read_text())
    return {k: float(v) for k, v in raw["points"].items()}


def download_players(cfg: dict) -> Path:
    dest = _p(cfg["paths"]["players_csv"])
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        print(f"  downloading players.csv.gz -> {dest}")
        urllib.request.urlretrieve(PLAYERS_URL, dest)  # noqa: S310 (trusted CC0 R2)
    return dest


def load_squad_features(cfg: dict) -> pd.DataFrame:
    """Per-team squad aggregates from the dcaribou player dump.

    Rosters in the dump are incomplete (only ~2.4k players carry a current
    national-team id), so we approximate each squad as the 26 highest-valued
    recent players holding that citizenship — a robust proxy for squad
    strength (total market value, mean age, caps).
    """
    path = download_players(cfg)
    df = pd.read_csv(path, compression="gzip")
    df = df[df["last_season"] >= 2023].copy()
    df["team_id"] = df["country_of_citizenship"].map(teams.resolve)
    df = df[df["team_id"].notna()].copy()
    df["market_value_in_eur"] = pd.to_numeric(
        df["market_value_in_eur"], errors="coerce"
    )
    df["dob"] = pd.to_datetime(df["date_of_birth"], errors="coerce")
    asof = pd.Timestamp(cfg["training"]["cutoff_date"])
    df["age"] = (asof - df["dob"]).dt.days / 365.25
    df["caps"] = pd.to_numeric(df["international_caps"], errors="coerce")

    rows = []
    for tid, g in df.groupby("team_id"):
        squad = g.sort_values("market_value_in_eur", ascending=False).head(26)
        val = squad["market_value_in_eur"].fillna(0)
        rows.append(
            {
                "team_id": tid,
                "squad_value_eur": float(val.sum()),
                "squad_value_top3_eur": float(val.head(3).sum()),
                "squad_age_mean": float(squad["age"].mean(skipna=True)),
                "squad_caps_mean": float(squad["caps"].mean(skipna=True)),
            }
        )
    return pd.DataFrame(rows).set_index("team_id")


def download_valuations(cfg: dict) -> Path:
    dest = _p("ml/data/cache/player_valuations.csv.gz")
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        print(f"  downloading player_valuations.csv.gz -> {dest}")
        urllib.request.urlretrieve(VALUATIONS_URL, dest)  # noqa: S310
    return dest


def historical_squad_values(cfg: dict) -> dict[str, list[tuple[int, float]]]:
    """Per-country yearly squad-value series from dcaribou valuations.

    For each (country, year): the top-26 players (by that year's latest
    valuation) summed → a causal squad-strength signal usable as a training
    feature. Keyed by trigram where the citizenship maps to a WC2026 team, else
    by normalized country name. Returns key -> sorted [(year, log_value)].
    """
    players = pd.read_csv(
        download_players(cfg),
        usecols=["player_id", "country_of_citizenship"],
    )
    vals = pd.read_csv(
        download_valuations(cfg),
        usecols=["player_id", "date", "market_value_in_eur"],
    )
    vals["date"] = pd.to_datetime(vals["date"], errors="coerce")
    vals = vals.dropna(subset=["date", "market_value_in_eur"])
    vals["year"] = vals["date"].dt.year
    df = vals.merge(players, on="player_id", how="inner")
    df = df.dropna(subset=["country_of_citizenship"])

    # latest valuation per (player, country, year)
    df = df.sort_values("date").drop_duplicates(
        subset=["player_id", "country_of_citizenship", "year"], keep="last"
    )

    def key_for(country: str) -> str:
        return teams.resolve(country) or teams.normalize(country)

    df["key"] = df["country_of_citizenship"].map(key_for)

    table: dict[str, list[tuple[int, float]]] = {}
    for (key, year), g in df.groupby(["key", "year"]):
        top = g.nlargest(26, "market_value_in_eur")["market_value_in_eur"].sum()
        if top > 0:
            table.setdefault(key, []).append((int(year), float(np.log(top))))
    for key in table:
        table[key].sort()
    return table


def value_as_of(table: dict, team_name: str, year: int) -> float:
    """log squad value for a team as of `year` (latest year <= match year)."""
    key = teams.resolve(team_name) or teams.normalize(team_name)
    series = table.get(key)
    if not series:
        return float("nan")
    best = float("nan")
    for y, v in series:
        if y <= year:
            best = v
        else:
            break
    return best


def load_coaches(cfg: dict) -> pd.DataFrame:
    """Curated 48-coach seed. Returns an empty frame if not yet built."""
    path = _p(cfg["paths"]["coaches_seed"])
    if not path.exists():
        print(f"  (coach seed {path} missing — coach features will be neutral)")
        return pd.DataFrame(
            columns=["coach_win_pct", "coach_prior_wc", "coach_tenure_days"]
        ).rename_axis("team_id")
    df = pd.read_csv(path)
    df = df[df["team_id"].isin(teams.ALL_TEAM_IDS)].copy()
    for c in ["matches", "wins", "draws", "losses", "prior_wc"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    df["coach_win_pct"] = np.where(
        df.get("matches", 0).fillna(0) > 0,
        df.get("wins", 0).fillna(0) / df.get("matches", np.nan),
        np.nan,
    )
    df["coach_prior_wc"] = df.get("prior_wc", 0).fillna(0)
    ts = pd.to_datetime(df.get("tenure_start"), errors="coerce")
    df["coach_tenure_days"] = (pd.Timestamp(cfg["training"]["cutoff_date"]) - ts).dt.days
    return df.set_index("team_id")[
        ["coach_win_pct", "coach_prior_wc", "coach_tenure_days"]
    ]


def load_host_cities(cfg: dict) -> pd.DataFrame:
    return pd.read_csv(_p(cfg["paths"]["host_cities"]))


def load_market_consensus(cfg: dict) -> dict[str, float]:
    raw = json.loads(_p(cfg["paths"]["market_consensus"]).read_text())
    return {k: float(v) for k, v in raw["title_prob"].items()}
