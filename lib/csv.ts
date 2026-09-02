import fs from "node:fs";
import path from "node:path";
import { CHANNELS, CSV_CHANNEL_IDS, type Channel } from "./channels";
import { ensureDir, uploadsDir } from "./data-dir";
import { filterSeries } from "./range";
import type { ChannelBlock, DailyPoint } from "./types";

const DATE_HEADERS = new Set(["date", "day"]);
const REVENUE_HEADERS = new Set([
  "estimated revenue (usd)",
  "estimated revenue",
  "revenue (usd)",
  "revenue",
  "estimated partner revenue",
  "your estimated revenue (usd)",
]);
const RPM_HEADERS = new Set(["rpm (usd)", "rpm", "estimated rpm", "estimated rpm (usd)"]);
const VIEWS_HEADERS = new Set(["views", "video views"]);
const CHANNEL_ID_HEADERS = new Set([
  "channel id",
  "channel_id",
  "youtube channel id",
  "channelid",
  "external id",
]);

function normHeader(h: string): string {
  return (h || "").trim().toLowerCase();
}

function parseNumber(s: string | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(/,/g, "").replace(/\$/g, "").replace(/€/g, "");
  if (t === "" || t === "-" || t === "—") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function pickCol(headers: string[], candidates: Set<string>): number | null {
  for (let i = 0; i < headers.length; i++) {
    if (candidates.has(normHeader(headers[i]))) return i;
  }
  return null;
}

function isExampleFile(name: string, head: string): boolean {
  const n = name.toUpperCase();
  const h = head.slice(0, 800).toUpperCase();
  return n.startsWith("EXAMPLE") || n.includes(".EXAMPLE.") || h.includes("EXAMPLE DATA");
}

function channelTokens(ch: Channel): Set<string> {
  const tokens = new Set<string>();
  const add = (v: string) => {
    const t = v.toLowerCase().replace(/\s+/g, "");
    if (t) tokens.add(t);
  };
  add(ch.id);
  add(ch.youtubeChannelId);
  add(ch.alias);
  add(ch.name);
  if (ch.id === "eventvods") {
    add("eventvods");
    add("loleventvods");
    add("eventvod");
  }
  if (ch.id === "onivia") add("onivia");
  return tokens;
}

function matchChannels(filename: string, requested?: string): Channel[] {
  const fname = filename.toLowerCase();
  if (requested && CSV_CHANNEL_IDS.has(requested)) {
    const ch = CHANNELS.find((c) => c.id === requested);
    return ch ? [ch] : [];
  }
  return CHANNELS.filter((ch) => {
    if (!CSV_CHANNEL_IDS.has(ch.id)) return false;
    const toks = channelTokens(ch);
    return [...toks].some((t) => t && fname.includes(t));
  });
}

export type ParsedCsv = {
  file: string;
  example: boolean;
  channelIds: string[];
  series: DailyPoint[];
  error: string | null;
};

export function parseCsvText(filename: string, text: string, requestedChannel?: string): ParsedCsv {
  if (isExampleFile(filename, text)) {
    return {
      file: filename,
      example: true,
      channelIds: [],
      series: [],
      error: "EXAMPLE file ignored — this desk never uses sample numbers.",
    };
  }

  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    if (line.trim()) lines.push(line);
  }
  if (!lines.length) {
    return { file: filename, example: false, channelIds: [], series: [], error: "CSV is empty." };
  }

  const rows = lines.map(parseCsvLine);
  let headerIdx = -1;
  let headers: string[] | null = null;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const lowered = rows[i].map(normHeader);
    if (lowered.some((h) => DATE_HEADERS.has(h))) {
      headerIdx = i;
      headers = rows[i];
      break;
    }
  }
  if (!headers) {
    return {
      file: filename,
      example: false,
      channelIds: [],
      series: [],
      error: "No Date column found. Expected headers like Date, views, estimated revenue.",
    };
  }

  const di = pickCol(headers, DATE_HEADERS);
  const ri = pickCol(headers, REVENUE_HEADERS);
  const rpmi = pickCol(headers, RPM_HEADERS);
  const vi = pickCol(headers, VIEWS_HEADERS);
  const ci = pickCol(headers, CHANNEL_ID_HEADERS);
  if (di == null) {
    return {
      file: filename,
      example: false,
      channelIds: [],
      series: [],
      error: "Date column is required.",
    };
  }
  if (vi == null && ri == null) {
    return {
      file: filename,
      example: false,
      channelIds: [],
      series: [],
      error: "Need a views and/or estimated revenue column.",
    };
  }

  const matched = matchChannels(filename, requestedChannel);
  if (!matched.length) {
    return {
      file: filename,
      example: false,
      channelIds: [],
      series: [],
      error: "Filename must include eventvods, loleventvods, or onivia (or pass channel=).",
    };
  }

  const allowedYt = new Set(CHANNELS.map((c) => c.youtubeChannelId));
  const byDate = new Map<string, DailyPoint>();
  for (const row of rows.slice(headerIdx + 1)) {
    if (di >= row.length) continue;
    if (ci != null && ci < row.length) {
      const rowYt = (row[ci] || "").trim();
      if (rowYt && !allowedYt.has(rowYt)) continue;
    }
    const day = (row[di] || "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const views = vi != null && vi < row.length ? parseNumber(row[vi]) : null;
    const revenue = ri != null && ri < row.length ? parseNumber(row[ri]) : null;
    let rpm = rpmi != null && rpmi < row.length ? parseNumber(row[rpmi]) : null;
    if (rpm == null && revenue != null && views) rpm = (revenue / views) * 1000;
    if (views == null && revenue == null) continue;
    const prev = byDate.get(day) || { date: day, views: null, revenue: null, rpm: null };
    byDate.set(day, {
      date: day,
      views: views ?? prev.views,
      revenue: revenue ?? prev.revenue,
      rpm: rpm ?? prev.rpm,
    });
  }

  const series = [...byDate.keys()].sort().map((k) => byDate.get(k)!);
  return {
    file: filename,
    example: false,
    channelIds: matched.map((c) => c.id),
    series,
    error: series.length ? null : "No daily rows parsed from this file.",
  };
}

export function safeStoreName(channelId: string, original: string): string {
  const base = original.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^\.+/, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${channelId}-${stamp}-${base || "upload.csv"}`;
}

export function saveCsv(channelId: string, originalName: string, text: string): { path: string; name: string } {
  const dir = uploadsDir();
  ensureDir(dir);
  const name = safeStoreName(channelId, originalName);
  const dest = path.join(dir, name);
  fs.writeFileSync(dest, text, "utf8");
  const latest = path.join(dir, `${channelId}-latest.csv`);
  fs.writeFileSync(latest, text, "utf8");
  return { path: dest, name };
}


function storeChannelId(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (lower.startsWith("eventvods-") || lower.includes("eventvods") || lower.includes("loleventvods")) return "eventvods";
  if (lower.startsWith("onivia-") || lower.includes("onivia")) return "onivia";
  return undefined;
}

function seedDir(): string {
  return path.join(process.cwd(), "data", "seed");
}

function applyCsvFile(
  dir: string,
  name: string,
  start: string | undefined,
  end: string | undefined,
  out: Record<string, ChannelBlock>,
): void {
  const full = path.join(dir, name);
  let text: string;
  try {
    text = fs.readFileSync(full, "utf8");
  } catch {
    return;
  }
  const requested = storeChannelId(name);
  const parsed = parseCsvText(name, text, requested);
  if (parsed.example || !parsed.series.length) return;
  const stat = fs.statSync(full);
  const ids = parsed.channelIds.length ? parsed.channelIds : requested ? [requested] : [];
  for (const cid of ids) {
    if (!out[cid]) continue;
    const series = start && end ? filterSeries(parsed.series, start, end) : parsed.series;
    out[cid] = {
      channelId: cid,
      youtubeChannelId: CHANNELS.find((c) => c.id === cid)!.youtubeChannelId,
      source: "csv",
      ok: true,
      series,
      note: series.length
        ? `CSV · YouTube Studio · ${name}`
        : "CSV is on file but has no rows in this range.",
      error: null,
      file: name,
      uploadedAt: stat.mtime.toISOString(),
    };
  }
}

export function loadImports(start?: string, end?: string): Record<string, ChannelBlock> {
  const out: Record<string, ChannelBlock> = {};
  for (const ch of CHANNELS) {
    if (!CSV_CHANNEL_IDS.has(ch.id)) continue;
    out[ch.id] = {
      channelId: ch.id,
      youtubeChannelId: ch.youtubeChannelId,
      source: "none",
      ok: false,
      series: [],
      note: `No Studio CSV for ${ch.alias} yet. Upload a daily export (Date, views, estimated revenue). Empty until a real file is parsed.`,
      error: null,
      file: null,
      uploadedAt: null,
    };
  }
  const dirs = [seedDir(), uploadsDir()];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".csv") || f.endsWith(".tsv"))
      .filter((f) => !isExampleFile(f, ""));
    files.sort();
    files.sort((a, b) => Number(a.includes("-latest.")) - Number(b.includes("-latest.")));
    for (const name of files) applyCsvFile(dir, name, start, end, out);
  }
  return out;
}
