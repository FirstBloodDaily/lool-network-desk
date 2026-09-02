import { NextResponse } from "next/server";
import { CHANNELS, CSV_CHANNEL_IDS } from "@/lib/channels";
import { loadImports, parseCsvText, saveCsv } from "@/lib/csv";
import { RangeError, resolveRange } from "@/lib/range";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rangeKey = url.searchParams.get("range");
  let start = url.searchParams.get("start") || undefined;
  let end = url.searchParams.get("end") || undefined;
  if (rangeKey) {
    try {
      const rng = resolveRange(rangeKey, start, end);
      start = rng.start;
      end = rng.end;
    } catch (e) {
      const msg = e instanceof RangeError ? e.message : "Invalid range.";
      return NextResponse.json({ ok: false, error: msg, byChannel: {} }, { status: 400 });
    }
  }
  const byChannel = loadImports(start, end);
  return NextResponse.json(
    {
      ok: true,
      error: null,
      byChannel,
      csvChannels: CHANNELS.filter((c) => CSV_CHANNEL_IDS.has(c.id)).map((c) => ({
        id: c.id,
        name: c.alias,
        youtubeChannelId: c.youtubeChannelId,
      })),
      note: "Eventvods and Onivia use Studio CSV until an Owner YouTube Analytics login exists. EXAMPLE files are ignored.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Send multipart/form-data with file and channel=eventvods|onivia." },
      { status: 400 },
    );
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read upload." }, { status: 400 });
  }
  const channel = String(form.get("channel") || "").trim().toLowerCase();
  if (!CSV_CHANNEL_IDS.has(channel)) {
    return NextResponse.json(
      { ok: false, error: "channel must be eventvods or onivia." },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, error: "Missing file." }, { status: 400 });
  }
  const blob = file as File;
  const name = blob.name || `${channel}.csv`;
  if (!/\.(csv|tsv|txt)$/i.test(name)) {
    return NextResponse.json({ ok: false, error: "File must be .csv (or .tsv)." }, { status: 400 });
  }
  const text = await blob.text();
  const parsed = parseCsvText(name, text, channel);
  if (parsed.example) {
    return NextResponse.json(
      { ok: false, error: parsed.error, parsed: null },
      { status: 400 },
    );
  }
  if (parsed.error && !parsed.series.length) {
    return NextResponse.json({ ok: false, error: parsed.error, parsed: null }, { status: 400 });
  }
  const saved = saveCsv(channel, name, text);
  return NextResponse.json({
    ok: true,
    error: null,
    file: saved.name,
    channel,
    rows: parsed.series.length,
    firstDate: parsed.series[0]?.date || null,
    lastDate: parsed.series[parsed.series.length - 1]?.date || null,
    note: `Stored ${saved.name}. Investor UI uses parsed rows only — no sample numbers.`,
  });
}
