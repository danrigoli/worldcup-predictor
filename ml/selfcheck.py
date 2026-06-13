"""Fast invariants for the ML package + exported artifacts.

Run: ml/.venv/bin/python -m ml.selfcheck   (or: pnpm ml:check)
Exits non-zero on any failure. Cheap enough to run in CI before shipping a
re-export.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from . import teams

REPO = Path(__file__).resolve().parents[1]
FAILURES: list[str] = []


def check(cond: bool, msg: str):
    if not cond:
        FAILURES.append(msg)


def main() -> int:
    # --- team registry ---
    check(len(teams.ALL_TEAM_IDS) == 48, "expected 48 teams")
    check(len(set(teams.ALL_TEAM_IDS)) == 48, "team ids must be unique")
    for spelling, tid in [
        ("South Korea", "KOR"), ("Czech Republic", "CZE"), ("United States", "USA"),
        ("Turkey", "TUR"), ("Ivory Coast", "CIV"), ("Cape Verde", "CPV"),
        ("DR Congo", "COD"), ("Iran", "IRN"), ("Curaçao", "CUW"),
    ]:
        check(teams.resolve(spelling) == tid, f"{spelling!r} should resolve to {tid}")
    check(teams.resolve("Italy") is None, "non-WC team must resolve to None")

    # --- exported lambda matrix ---
    mpath = REPO / "public/artifacts/lambda_matrix.latest.json"
    if mpath.exists():
        m = json.loads(mpath.read_text())
        ids = m["teams"]
        check(len(ids) == 48, "matrix must cover 48 teams")
        check(set(ids) == set(teams.ALL_TEAM_IDS), "matrix ids must match registry")
        lo, hi = m["lambda_clamp"]
        bad_range = anti = 0
        for i in ids:
            for j in ids:
                if i == j:
                    continue
                lh, la = m["neutral"][i][j]
                if not (lo <= lh <= hi and lo <= la <= hi):
                    bad_range += 1
                if abs(m["neutral"][i][j][0] - m["neutral"][j][i][1]) > 1e-6:
                    anti += 1
        check(bad_range == 0, f"{bad_range} matrix lambdas outside clamp {lo}-{hi}")
        check(anti == 0, f"{anti} matrix cells violate antisymmetry")
    else:
        print(f"  (no exported matrix at {mpath.relative_to(REPO)} — run pnpm ml:all)")

    if FAILURES:
        print("SELFCHECK FAILED:")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print(f"selfcheck OK ({len(teams.ALL_TEAM_IDS)} teams, matrix validated)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
