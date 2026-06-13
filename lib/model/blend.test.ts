import { describe, expect, it } from "vitest";
import { blendRatings } from "./blend";

describe("blendRatings", () => {
  const ids = ["AAA", "BBB", "CCC", "DDD"];
  const elo = { AAA: 2000, BBB: 1900, CCC: 1800, DDD: 1700 };
  const fifa = { AAA: 1800, BBB: 1750, CCC: 1600, DDD: 1500 };
  const values = { AAA: 1.2e9, BBB: 8e8, CCC: 3e8, DDD: 1e8 };

  it("preserves ordering when all signals agree", () => {
    const blended = blendRatings(ids, elo, fifa, values);
    expect(blended.AAA).toBeGreaterThan(blended.BBB);
    expect(blended.BBB).toBeGreaterThan(blended.CCC);
    expect(blended.CCC).toBeGreaterThan(blended.DDD);
  });

  it("stays on the Elo scale (mean preserved)", () => {
    const blended = blendRatings(ids, elo, fifa, values);
    const mean = ids.reduce((a, id) => a + blended[id], 0) / ids.length;
    expect(mean).toBeCloseTo(1850, 6);
  });

  it("handles missing market values via renormalization", () => {
    const blended = blendRatings(ids, elo, fifa, { AAA: 1.2e9, BBB: 8e8 });
    for (const id of ids) expect(Number.isFinite(blended[id])).toBe(true);
    expect(blended.AAA).toBeGreaterThan(blended.DDD);
  });

  it("a strong secondary signal moves the blend", () => {
    // AAA and DDD nearly equal on Elo, far apart on fifa + value:
    // the blend must separate them beyond the raw Elo gap.
    const nearFlat = { AAA: 1801, BBB: 1800, CCC: 1800, DDD: 1799 };
    const blended = blendRatings(ids, nearFlat, fifa, values);
    expect(blended.AAA - blended.DDD).toBeGreaterThan(
      nearFlat.AAA - nearFlat.DDD
    );
  });
});
