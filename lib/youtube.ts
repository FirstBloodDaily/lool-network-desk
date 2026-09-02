import { OPLOL_YOUTUBE_ID, CHANNELS } from "./channels";
import { cacheDir, ensureDir } from "./data-dir";
import { filterSeries } from "./range";
import type { ChannelBlock, DailyPoint, RangeResolved } from "./types";
import fs from "node:fs";
import path from "node:path";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const YT_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
const METRICS_FULL = "views,estimatedRevenue";
const METRICS_VIEWS = "views";

export function googleConfig(): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || "").trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export function missingGoogleMessage(): string {
  const missing: string[] = [];
  if (!(process.env.GOOGLE_CLIENT_ID || "").trim()) missing.push("GOOGLE_CLIENT_ID");
  if (!(process.env.GOOGLE_CLIENT_SECRET || "").trim()) missing.push("GOOGLE_CLIENT_SECRET");
  if (!(process.env.GOOGLE_REFRESH_TOKEN || "").trim()) missing.push("GOOGLE_REFRESH_TOKEN");
  if (!missing.length) return "YouTube Analytics is not configured.";
  return (
    "YouTube Analytics for OPLOLReplay is not configured. Missing " +
    missing.join(", ") +
    ". Live numbers are not invented — this channel stays empty until those env vars are set."
  );
}

type TokenCache = { accessToken: string; expiry: number };

let memToken: TokenCache | null = null;

async function refreshAccessToken(): Promise<{ token: string } | { error: string }> {
  const cfg = googleConfig();
  if (!cfg) return { error: missingGoogleMessage() };
  const now = Date.now();
  if (memToken && memToken.expiry - 60_000 > now) {
    return { token: memToken.accessToken };
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
  });
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      cache: "no-store",
    });
  } catch (e) {
    return { error: "Could not reach Google token endpoint: " + (e instanceof Error ? e.message : String(e)) };
  }
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    const msg = [json.error, json.error_description].filter(Boolean).join(" — ") || `HTTP ${res.status}`;
    return { error: "Google refresh token failed: " + msg + ". OPLOLReplay live data is not shown." };
  }
  memToken = {
    accessToken: json.access_token,
    expiry: now + Math.max(Number(json.expires_in) || 3600, 60) * 1000,
  };
  return { token: json.access_token };
}

function googleErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "YouTube Analytics error";
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: string; status?: string };
    return o.message || o.status || "YouTube Analytics error";
  }
  return "YouTube Analytics error";
}

function parseReport(body: {
  columnHeaders?: { name?: string }[];
  rows?: unknown[][];
}): DailyPoint[] {
  const headers = (body.columnHeaders || []).map((h) => h.name || "");
  const rows = body.rows || [];
  const out: DailyPoint[] = [];
  for (const row of rows) {
    const rec: Record<string, unknown> = {};
    headers.forEach((name, i) => {
      rec[name] = row[i];
    });
    const day = String(rec.day || rec.date || "").slice(0, 10);
    if (!day) continue;
    const viewsRaw = rec.views;
    let views: number | null = null;
    if (viewsRaw != null && viewsRaw !== "") {
      const n = Number(viewsRaw);
      views = Number.isFinite(n) ? Math.round(n) : null;
    }
    let revenue: number | null = null;
    if (rec.estimatedRevenue != null && rec.estimatedRevenue !== "") {
      const n = Number(rec.estimatedRevenue);
      revenue = Number.isFinite(n) ? n : null;
    }
    const rpm = revenue != null && views ? (revenue / views) * 1000 : null;
    out.push({ date: day, views, revenue, rpm });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

async function queryReports(
  accessToken: string,
  start: string,
  end: string,
  metrics: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const q = new URLSearchParams({
    ids: `channel==${OPLOL_YOUTUBE_ID}`,
    startDate: start,
    endDate: end,
    metrics,
    dimensions: "day",
    sort: "day",
  });
  const res = await fetch(`${YT_ANALYTICS}?${q.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

function cachePath(rng: RangeResolved): string {
  const name = `oplol_${rng.key}_${rng.start}_${rng.end}.json`.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(cacheDir(), name);
}

function emptyOplol(note: string, error: string | null = null): ChannelBlock {
  const ch = CHANNELS[0];
  return {
    channelId: ch.id,
    youtubeChannelId: ch.youtubeChannelId,
    source: "none",
    ok: false,
    series: [],
    note,
    error,
  };
}

export async function fetchOplolAnalytics(
  rng: RangeResolved,
  refresh = false,
): Promise<ChannelBlock> {
  const cfg = googleConfig();
  if (!cfg) return emptyOplol(missingGoogleMessage(), missingGoogleMessage());

  const file = cachePath(rng);
  if (!refresh && fs.existsSync(file)) {
    try {
      const cached = JSON.parse(fs.readFileSync(file, "utf8")) as ChannelBlock;
      if (cached.series?.length) {
        return { ...cached, note: (cached.note || "YouTube Analytics") + " · cached" };
      }
    } catch {
      /* ignore bad cache */
    }
  }

  const tok = await refreshAccessToken();
  if ("error" in tok) return emptyOplol(tok.error, tok.error);

  let { status, body } = await queryReports(tok.token, rng.start, rng.end, METRICS_FULL);
  let revenueOk = true;
  let note: string | null = "YouTube Analytics · OPLOLReplay";

  if (status !== 200) {
    const msg = googleErrorMessage(body);
    const low = msg.toLowerCase();
    const revenueForbidden =
      status === 400 ||
      status === 403 ||
      low.includes("forbidden") ||
      low.includes("estimatedrevenue") ||
      low.includes("permission");
    if (revenueForbidden || status !== 200) {
      const second = await queryReports(tok.token, rng.start, rng.end, METRICS_VIEWS);
      if (second.status === 200) {
        body = second.body;
        status = second.status;
        revenueOk = false;
        note =
          "estimatedRevenue is not available on this Google login. Views only — revenue is not invented.";
      } else {
        return emptyOplol(
          "Cannot read OPLOLReplay Analytics: " + msg,
          msg,
        );
      }
    }
  }

  let series = parseReport(body as { columnHeaders?: { name?: string }[]; rows?: unknown[][] });
  if (!revenueOk) {
    series = series.map((p) => ({ ...p, revenue: null, rpm: null }));
  }
  series = filterSeries(series, rng.start, rng.end);

  const rec: ChannelBlock = {
    channelId: "oplol",
    youtubeChannelId: OPLOL_YOUTUBE_ID,
    source: series.length ? "live" : "none",
    ok: true,
    series,
    note: series.length ? note : "YouTube Analytics returned no rows for this range.",
    error: null,
    fetchedAt: new Date().toISOString(),
  };
  try {
    ensureDir(cacheDir());
    if (series.length) fs.writeFileSync(file, JSON.stringify(rec, null, 2) + "\n", "utf8");
  } catch {
    /* cache is optional */
  }
  return rec;
}
