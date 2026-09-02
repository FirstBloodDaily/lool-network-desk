import { TIMEZONE } from "./channels";
import type { RangeResolved } from "./types";

const MONTH_RE = /^(\d{4})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function nicosiaParts(now = new Date()): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(now);
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day") };
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function nicosiaTodayStr(now = new Date()): string {
  const { y, m, d } = nicosiaParts(now);
  return ymd(y, m, d);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export class RangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RangeError";
  }
}

export function resolveRange(
  rangeKey: string | null | undefined,
  startS?: string | null,
  endS?: string | null,
  now = new Date(),
): RangeResolved {
  const today = nicosiaTodayStr(now);
  const { y, m } = nicosiaParts(now);
  const key = (rangeKey || "28d").trim();

  let start: string;
  let end: string;
  let label: string;

  if (key === "28d") {
    start = addDays(today, -27);
    end = today;
    label = "Last 28 days";
  } else if (key === "90d") {
    start = addDays(today, -89);
    end = today;
    label = "Last 90 days";
  } else if (key === "365d") {
    start = addDays(today, -364);
    end = today;
    label = "Last 365 days";
  } else if (key === "custom") {
    if (!startS || !endS) {
      throw new RangeError("Custom range needs start and end (YYYY-MM-DD).");
    }
    start = startS.slice(0, 10);
    end = endS.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new RangeError("Dates must be YYYY-MM-DD.");
    }
    if (end > today) end = today;
    if (start > end) throw new RangeError("Custom start is after end.");
    const days =
      (Date.parse(end + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / 86400000;
    if (days > 500) throw new RangeError("Custom range is too long (max 500 days).");
    label = `${start} → ${end}`;
  } else {
    const match = MONTH_RE.exec(key);
    if (!match) {
      throw new RangeError("Unknown range; use 28d, 90d, 365d, YYYY-MM, or custom.");
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year !== y) throw new RangeError("Month range must be in the running year.");
    if (month < 1 || month > m) throw new RangeError("Month is outside January–current month.");
    start = ymd(year, month, 1);
    let last = ymd(year, month, lastDayOfMonth(year, month));
    if (last > today) last = today;
    end = last;
    label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return { key, start, end, label, timezone: TIMEZONE };
}

export function monthOptions(now = new Date()): { key: string; label: string }[] {
  const { y, m } = nicosiaParts(now);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const out: { key: string; label: string }[] = [];
  for (let i = 1; i <= m; i++) {
    out.push({ key: `${y}-${pad(i)}`, label: `${months[i - 1]} ${y}` });
  }
  return out;
}

export function filterSeries<T extends { date: string }>(
  series: T[],
  start: string,
  end: string,
): T[] {
  return series.filter((r) => {
    const d = (r.date || "").slice(0, 10);
    if (!d) return false;
    if (d < start) return false;
    if (d > end) return false;
    return true;
  });
}
