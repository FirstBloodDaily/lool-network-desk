import { NextResponse } from "next/server";
import { CHANNELS, TIMEZONE, CURRENCY } from "@/lib/channels";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timezone: TIMEZONE,
    currency: CURRENCY,
    channels: CHANNELS.map((c) => ({
      id: c.id,
      name: c.name,
      alias: c.alias,
      youtubeChannelId: c.youtubeChannelId,
      url: c.url,
      source: c.source,
      color: c.color,
    })),
    notes: {
      metrics: "100% network views, estimated revenue USD, RPM. No ownership split.",
      oplol: "OPLOLReplay can be live YouTube Analytics when Google env vars are set.",
      csv: "Eventvods and Onivia need a Studio CSV until Owner Analytics is available.",
    },
  });
}
