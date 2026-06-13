"use client";

import { useEffect, useRef, useState } from "react";
import type {
  SimWorkerRequest,
  SimWorkerResponse,
} from "@/lib/sim/worker";
import type { Match, OddsByTeam, Overrides, Ratings } from "@/lib/types";

const DEBOUNCE_MS = 150;

interface Args {
  matches: Match[];
  preRatings: Ratings;
  fifaRank: Ratings;
  baselineOdds: OddsByTeam;
  overrides: Overrides;
  simCount: number;
  seed: number;
}

/**
 * Runs the what-if simulation in a Web Worker, debounced on override changes.
 * With no overrides it returns the server baseline without spawning work.
 */
export function useSimWorker({
  matches,
  preRatings,
  fifaRank,
  baselineOdds,
  overrides,
  simCount,
  seed,
}: Args): { odds: OddsByTeam; running: boolean } {
  const [odds, setOdds] = useState<OddsByTeam>(baselineOdds);
  const [running, setRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const worker = new Worker(
      new URL("../../lib/sim/worker.ts", import.meta.url)
    );
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<SimWorkerResponse>) => {
      if (e.data.id === reqId.current) {
        setOdds(e.data.odds);
        setRunning(false);
      }
    };
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    const hasOverrides = Object.keys(overrides).length > 0;
    if (!hasOverrides) {
      setOdds(baselineOdds);
      setRunning(false);
      return;
    }
    setRunning(true);
    const timer = setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) return;
      const id = ++reqId.current;
      const req: SimWorkerRequest = {
        id,
        matches,
        preRatings,
        fifaRank,
        overrides,
        simCount,
        seed,
      };
      worker.postMessage(req);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  return { odds, running };
}
