import { TIMEZONE } from "./channels";

export function fmtUSD(n: number | null | undefined, d = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return (
    sign +
    "$" +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
  );
}

export function fmtUSD0(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? "—" : fmtUSD(n, 0);
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtK(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.abs(n) >= 1000
    ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
    : Math.round(n).toString();
}

export const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

export const fullDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function hourInTz(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(now),
  );
}

export function greeting(now = new Date()): string {
  const h = hourInTz(now);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function trend(cur: number | null, prev: number | null): { kind: "up" | "down" | "flat"; label: string } {
  if (prev == null || !prev || cur == null) return { kind: "flat", label: "—" };
  const d = (cur - prev) / Math.abs(prev);
  if (Math.abs(d) < 0.0005) return { kind: "flat", label: "0.0%" };
  return { kind: d >= 0 ? "up" : "down", label: `${d >= 0 ? "↗" : "↘"} ${Math.abs(d * 100).toFixed(1)}%` };
}

export function rpmOf(views: number | null, revenue: number | null): number | null {
  if (revenue == null || !views) return null;
  return (revenue / views) * 1000;
}
