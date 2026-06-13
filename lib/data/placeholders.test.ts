import { describe, expect, it } from "vitest";
import { parseSlot } from "./placeholders";

describe("parseSlot", () => {
  it("parses group ranks", () => {
    expect(parseSlot("1A")).toEqual({ kind: "group-rank", group: "A", rank: 1 });
    expect(parseSlot("2C")).toEqual({ kind: "group-rank", group: "C", rank: 2 });
  });

  it("parses third-place pools in both feed formats", () => {
    expect(parseSlot("3ABCDF")).toEqual({
      kind: "third-pool",
      groups: ["A", "B", "C", "D", "F"],
    });
    expect(parseSlot("3A/B/C/D/F")).toEqual({
      kind: "third-pool",
      groups: ["A", "B", "C", "D", "F"],
    });
  });

  it("parses winner/loser refs", () => {
    expect(parseSlot("W73")).toEqual({ kind: "match-winner", matchNumber: 73 });
    expect(parseSlot("L101")).toEqual({ kind: "match-loser", matchNumber: 101 });
  });

  it("resolves real team names", () => {
    expect(parseSlot("Mexico")).toEqual({ kind: "team", team: "MEX" });
    expect(parseSlot("Korea Republic")).toEqual({ kind: "team", team: "KOR" });
  });

  it("returns null for unknown placeholders", () => {
    expect(parseSlot("To be announced")).toBeNull();
    expect(parseSlot("")).toBeNull();
  });
});
