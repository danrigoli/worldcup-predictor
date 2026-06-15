"""Build data/seeds/player-values.json — per-team player market values used by
the lineup-aware match adjustment.

For each of the 48 teams: the squad pool (recent players of that citizenship,
by Transfermarkt value), the best-XI value (sum of the top 11), and a
replacement-level value (median of the bench tier) for starters we can't match
by name. Run: ml/.venv/bin/python -m ml.build_player_values
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import ingest, teams

REPO = Path(__file__).resolve().parents[1]
POOL = 30  # players stored per team (covers any plausible XI + bench)


def main() -> None:
    cfg = {"paths": {"players_csv": "ml/data/cache/players.csv.gz"}}
    path = ingest.download_players(cfg)
    df = pd.read_csv(path, compression="gzip")
    df = df[df["last_season"] >= 2023].copy()
    df["team_id"] = df["country_of_citizenship"].map(teams.resolve)
    df = df[df["team_id"].notna()]
    df["market_value_in_eur"] = pd.to_numeric(df["market_value_in_eur"], errors="coerce")
    df = df.dropna(subset=["market_value_in_eur"])
    df = df[df["market_value_in_eur"] > 0]

    out: dict = {"asOf": "2026-06", "teams": {}}
    for tid in teams.ALL_TEAM_IDS:
        squad = (
            df[df["team_id"] == tid]
            .sort_values("market_value_in_eur", ascending=False)
            .head(POOL)
        )
        vals = squad["market_value_in_eur"].to_numpy()
        if len(vals) < 11:
            # very thin data — neutral entry (no penalties will fire)
            out["teams"][tid] = {"xiValue": 0, "median": 0, "players": []}
            continue
        xi_value = float(vals[:11].sum())
        bench = vals[11:23] if len(vals) > 11 else vals[-1:]
        median = float(np.median(bench)) if len(bench) else float(vals[-1])
        players = [
            {"name": r["name"], "n": teams.normalize(r["name"]),
             "s": teams.normalize(str(r["name"]).split()[-1]),
             "v": float(r["market_value_in_eur"])}
            for _, r in squad.iterrows()
        ]
        out["teams"][tid] = {
            "xiValue": round(xi_value),
            "median": round(median),
            "players": players,
        }

    dest = REPO / "data" / "seeds" / "player-values.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    n = sum(1 for t in out["teams"].values() if t["players"])
    print(f"wrote {dest.relative_to(REPO)} — {n}/48 teams with squad pools")
    can = out["teams"]["CAN"]
    print(f"  CAN xiValue €{can['xiValue']/1e6:.0f}m, median €{can['median']/1e6:.1f}m, "
          f"top: {', '.join(p['name'] for p in can['players'][:3])}")


if __name__ == "__main__":
    main()
