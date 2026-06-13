"""WC2026 prediction ML package (wc_ml).

Pipeline: ingest -> running Elo -> stacked features -> LightGBM Poisson goals
model -> temporal-CV backtest vs the Elo+Dixon-Coles baseline -> export an
offline 48x48 lambda matrix + team ratings the TS Monte Carlo consumes.
"""
