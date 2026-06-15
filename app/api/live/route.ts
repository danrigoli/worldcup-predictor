import { NextResponse } from "next/server";
import { getLiveMatches } from "@/lib/data/live";
import type { Match } from "@/lib/types";

import fixturesSeed from "@/data/seeds/fixtures-2026.json";

// Polled by the matches page for near-real-time live status/scores/stats.
// Recomputed per request; the underlying ESPN fetches are cached (~20s today).
export const dynamic = "force-dynamic";

export async function GET() {
  const live = await getLiveMatches(fixturesSeed.matches as Match[]);
  return NextResponse.json(live, {
    headers: { "Cache-Control": "no-store" },
  });
}
