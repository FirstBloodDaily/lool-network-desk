import { CHANNELS } from "./channels";
import type { ChannelBlock, DailyPoint } from "./types";

/** Live Analytics wins on a day when it has the field; Studio CSV fills unpublished days. */
export function mergeLiveAndCsv(live?: ChannelBlock, csv?: ChannelBlock): ChannelBlock {
  const map = new Map<string, DailyPoint>();
  for (const p of csv?.series || []) {
    const day = (p.date || "").slice(0, 10);
    if (!day) continue;
    map.set(day, { date: day, views: p.views, revenue: p.revenue, rpm: p.rpm });
  }
  for (const p of live?.series || []) {
    const day = (p.date || "").slice(0, 10);
    if (!day) continue;
    const cur = map.get(day) || { date: day, views: null, revenue: null, rpm: null };
    if (p.views != null) cur.views = p.views;
    if (p.revenue != null) cur.revenue = p.revenue;
    cur.rpm = cur.revenue != null && cur.views ? (cur.revenue / cur.views) * 1000 : (p.rpm ?? cur.rpm);
    map.set(day, cur);
  }
  const series = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  const liveOk = !!(live && live.ok && live.series && live.series.length);
  const csvOk = !!(csv && csv.series && csv.series.length);
  const ch = CHANNELS.find((c) => c.id === "oplol")!;
  return {
    channelId: "oplol",
    youtubeChannelId: live?.youtubeChannelId || csv?.youtubeChannelId || ch.youtubeChannelId,
    source: liveOk ? "live" : csvOk ? "csv" : "none",
    ok: liveOk || csvOk,
    series,
    note: liveOk && csvOk
      ? "YouTube Analytics · Studio CSV fills days the API has not published"
      : (live?.note || csv?.note || null),
    error: null,
    file: csv?.file,
    uploadedAt: csv?.uploadedAt,
    fetchedAt: live?.fetchedAt,
  };
}
