/// <reference lib="webworker" />
import { runSimulation } from "@/lib/sim/run";
import type { Match, Overrides, Ratings } from "@/lib/types";

export interface SimWorkerRequest {
  id: number;
  matches: Match[];
  preRatings: Ratings;
  fifaRank: Ratings;
  overrides: Overrides;
  simCount: number;
  seed: number;
}

export interface SimWorkerResponse {
  id: number;
  odds: ReturnType<typeof runSimulation>["odds"];
}

self.onmessage = (e: MessageEvent<SimWorkerRequest>) => {
  const { id, matches, preRatings, fifaRank, overrides, simCount, seed } =
    e.data;
  const result = runSimulation(
    matches,
    preRatings,
    fifaRank,
    overrides,
    simCount,
    seed
  );
  const response: SimWorkerResponse = { id, odds: result.odds };
  (self as DedicatedWorkerGlobalScope).postMessage(response);
};
