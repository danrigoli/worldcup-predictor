"""End-to-end ML pipeline.

Usage (from repo root, with the venv active):
    python -m ml.pipeline                 # full run: train, backtest, export
    python -m ml.pipeline --stage backtest  # backtest only (no export)
    python -m ml.pipeline --no-backtest     # train + export, skip the CV gate
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from . import ingest
from .elo import EloConfig, run_elo
from .export import write_artifacts
from .features import build_training_frame
from .model import backtest, train_gbm

REPO = Path(__file__).resolve().parents[1]


def load_config() -> dict:
    return yaml.safe_load((REPO / "ml" / "config.yaml").read_text())


def main(argv=None):
    ap = argparse.ArgumentParser(description="WC2026 ML pipeline")
    ap.add_argument("--stage", choices=["all", "backtest"], default="all")
    ap.add_argument("--no-backtest", action="store_true")
    args = ap.parse_args(argv)

    cfg = load_config()

    print("[1/5] Ingesting match history + Elo")
    results = ingest.load_results(cfg)
    elo_cfg = EloConfig(**{
        "k_world_cup": cfg["elo"]["k_world_cup"],
        "k_continental_final": cfg["elo"]["k_continental_final"],
        "k_qualifier": cfg["elo"]["k_qualifier"],
        "k_tournament": cfg["elo"]["k_tournament"],
        "k_friendly": cfg["elo"]["k_friendly"],
        "home_advantage": cfg["elo"]["home_advantage"],
        "seed_rating": cfg["elo"]["seed_rating"],
    })
    with_elo = run_elo(results, elo_cfg)
    print(f"  {len(with_elo)} matches; {len(with_elo.attrs['final_ratings'])} teams rated")

    bt = None
    if args.stage == "backtest" or not args.no_backtest:
        print("[2/5] Temporal-CV backtest (GBM vs Elo+Dixon-Coles baseline)")
        bt = backtest(with_elo, cfg)
        for r in bt["per_tournament"]:
            flag = "OK" if r["gbm_rps"] < r["baseline_rps"] else "--"
            print(f"  {r['tournament']:9} n={r['matches']:>3} "
                  f"GBM RPS {r['gbm_rps']:.4f} vs baseline {r['baseline_rps']:.4f} [{flag}]")
        if bt["gbm_rps"] is not None:
            print(f"  OVERALL GBM {bt['gbm_rps']:.4f} vs baseline {bt['baseline_rps']:.4f} "
                  f"-> beats baseline: {bt['beats_baseline']}")
        if args.stage == "backtest":
            return 0

    print("[3/5] Training production GBM on full history")
    value_table = ingest.historical_squad_values(cfg)
    train_df, final_state = build_training_frame(with_elo, cfg, value_table)
    print(f"  {len(train_df)} stacked side-rows")
    model = train_gbm(train_df, cfg)

    print("[4/5] Building + exporting artifacts")
    write_artifacts(
        cfg, model,
        final_ratings_state=(with_elo.attrs["final_ratings"], final_state),
        backtest_result=bt,
    )

    print("[5/5] Done. Run `pnpm ml:calibrate` to fit the temperature and emit *.latest.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
