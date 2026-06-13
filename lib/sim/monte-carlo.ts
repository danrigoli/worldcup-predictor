import { SIM_COUNT, SEED } from "@/lib/constants";
import { mulberry32 } from "@/lib/rng";
import { ScoreSampler } from "@/lib/model/score-sampler";
import { ALL_TEAM_IDS } from "@/lib/names";
import { simulateOnce, type SimContext } from "@/lib/sim/tournament";
import type { OddsByTeam, SimResult, TeamId } from "@/lib/types";

interface Tally {
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  winner: number;
}

/**
 * Run N tournament simulations from a SimContext and aggregate per-team
 * stage-reach probabilities. Deterministic for a given seed.
 */
export function runSims(
  ctx: SimContext,
  simCount: number = SIM_COUNT,
  seed: number = SEED
): SimResult {
  const rng = mulberry32(seed);
  const sampler = new ScoreSampler(); // shared cache across all sims
  const tally = new Map<TeamId, Tally>();
  for (const id of ALL_TEAM_IDS) {
    tally.set(id, { r32: 0, r16: 0, qf: 0, sf: 0, final: 0, winner: 0 });
  }

  for (let i = 0; i < simCount; i++) {
    const { reached } = simulateOnce(ctx, sampler, rng);
    for (const [team, flags] of reached) {
      const t = tally.get(team);
      if (!t) continue;
      if (flags.r32) t.r32++;
      if (flags.r16) t.r16++;
      if (flags.qf) t.qf++;
      if (flags.sf) t.sf++;
      if (flags.final) t.final++;
      if (flags.winner) t.winner++;
    }
  }

  const odds: OddsByTeam = {};
  for (const id of ALL_TEAM_IDS) {
    const t = tally.get(id)!;
    odds[id] = {
      r32: t.r32 / simCount,
      r16: t.r16 / simCount,
      qf: t.qf / simCount,
      sf: t.sf / simCount,
      final: t.final / simCount,
      winner: t.winner / simCount,
    };
  }

  return { simCount, seed, odds };
}
