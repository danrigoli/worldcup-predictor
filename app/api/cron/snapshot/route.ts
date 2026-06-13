import { NextResponse } from "next/server";
import { captureSnapshot } from "@/lib/snapshot-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily snapshot of current title odds (Vercel cron or manual curl).
 * Auth: Bearer CRON_SECRET. Vercel cron sends this header automatically.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const snapshot = await captureSnapshot(new Date());
    return NextResponse.json({
      ok: true,
      date: snapshot.date,
      playedMatches: snapshot.playedMatches,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
