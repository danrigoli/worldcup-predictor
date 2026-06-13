import type { TeamId } from "@/lib/types";
import ratingsJson from "@/public/artifacts/team_ratings.latest.json";
import metaJson from "@/public/artifacts/meta.json";

export interface TeamRating {
  attack: number;
  defense: number;
  elo: number | null;
  strength: number;
  market_value_m: number | null;
  title_prob: number;
}

export interface ModelMeta {
  version: string;
  training_cutoff: string;
  training_start: string;
  half_life_days: number;
  features: string[];
  strength_blend: Record<string, number>;
  host_boost: number;
  backtest: {
    gbm_rps: number | null;
    baseline_rps: number | null;
    beats_baseline: boolean;
    per_tournament: Array<{
      tournament: string;
      matches: number;
      gbm_rps: number;
      baseline_rps: number;
    }>;
  } | null;
  calibration: {
    temperature: number | null;
    favorite_title_prob?: number;
    target?: number;
    sim_count?: number;
  };
}

export const teamRatings = ratingsJson.teams as Record<TeamId, TeamRating>;
export const modelMeta = metaJson as ModelMeta;
