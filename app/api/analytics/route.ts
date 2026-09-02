import { NextResponse } from "next/server";
import { CHANNELS, OPLOL_YOUTUBE_ID } from "@/lib/channels";
import { RangeError, resolveRange } from "@/lib/range";
import { fetchOplolAnalytics, googleConfig, missingGoogleMessage } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rangeKey = url.searchParams.get("range") || "28d";
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const refresh = url.searchParams.get("refresh") === "1";

  let rng;
  try {
    rng = resolveRange(rangeKey, start, end);
  } catch (e) {
    const msg = e instanceof RangeError ? e.message : "Invalid range.";
    return NextResponse.json({ ok: false, error: msg, range: null, byChannel: {} }, { status: 400 });
  }

  if (!googleConfig()) {
    return NextResponse.json(
      {
        ok: false,
        error: missingGoogleMessage(),
        range: rng,
        byChannel: {},
        allowlistIds: [OPLOL_YOUTUBE_ID],
        timezone: rng.timezone,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const block = await fetchOplolAnalytics(rng, refresh);
    return NextResponse.json(
      {
        ok: block.ok,
        error: block.ok ? null : block.error || block.note,
        range: rng,
        byChannel: { oplol: block, [OPLOL_YOUTUBE_ID]: block },
        allowlistIds: CHANNELS.map((c) => c.youtubeChannelId),
        timezone: rng.timezone,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: "YouTube Analytics request failed: " + msg,
        range: rng,
        byChannel: {},
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
