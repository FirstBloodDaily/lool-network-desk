"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHANNELS, TIMEZONE_LABEL, type Channel, shortName } from "@/lib/channels";
import type { ChannelBlock, DailyPoint, RangeResolved } from "@/lib/types";
import { monthOptions, deskTodayStr } from "@/lib/range";
import { dateFmt, fmtInt, fmtK, fmtUSD, fmtUSD0, fullDateFmt, greeting, rpmOf, trend } from "@/lib/format";
import Chart, { EmptyChart } from "./Chart";

type Page = "home" | "channel" | "imports";
type Metric = "revenue" | "views" | "rpm";

type RangeState = { key: string; start: string; end: string };

function icon(kind: "eye" | "dollar" | "trend" | "users") {
  if (kind === "eye") return (
    <svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
  );
  if (kind === "dollar") return (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h3.5a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3.5"/></svg>
  );
  if (kind === "trend") return (
    <svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>
  );
  return (
    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
  );
}

function metricOf(row: DailyPoint | undefined, key: Metric): number | null {
  if (!row) return null;
  if (key === "views") return row.views;
  if (key === "revenue") return row.revenue;
  if (row.rpm != null) return row.rpm;
  return rpmOf(row.views, row.revenue);
}

function rangeSums(series: DailyPoint[], key: Metric): { cur: number | null; prev: number | null; empty: boolean } {
  if (!series.length) return { cur: null, prev: null, empty: true };
  const usable = series.filter((r) => metricOf(r, key) != null);
  if (!usable.length) return { cur: null, prev: null, empty: true };
  const sum = (arr: DailyPoint[]) => {
    if (key === "rpm") {
      const views = arr.reduce((a, r) => a + (r.views || 0), 0);
      const rev = arr.reduce((a, r) => a + (r.revenue || 0), 0);
      return views ? (rev / views) * 1000 : null;
    }
    return arr.reduce((a, r) => a + (metricOf(r, key) || 0), 0);
  };
  const mid = Math.floor(usable.length / 2);
  const prev = usable.length >= 8 ? sum(usable.slice(0, mid)) : null;
  return { cur: sum(usable), prev, empty: false };
}

function combine(blocks: ChannelBlock[]): DailyPoint[] {
  const acc = new Map<string, { views: number; revenue: number; hasV: boolean; hasR: boolean }>();
  blocks.forEach((b) => {
    (b.series || []).forEach((r) => {
      const d = (r.date || "").slice(0, 10);
      if (!d) return;
      if (!acc.has(d)) acc.set(d, { views: 0, revenue: 0, hasV: false, hasR: false });
      const a = acc.get(d)!;
      if (r.views != null) { a.views += r.views; a.hasV = true; }
      if (r.revenue != null) { a.revenue += r.revenue; a.hasR = true; }
    });
  });
  return [...acc.keys()].sort().map((d) => {
    const a = acc.get(d)!;
    const views = a.hasV ? a.views : null;
    const revenue = a.hasR ? a.revenue : null;
    return { date: d, views, revenue, rpm: rpmOf(views, revenue) };
  });
}

function shortLabel(date: string): string {
  const dt = new Date(date + "T12:00:00");
  return dt.getDate() + " " + dt.toLocaleString("en", { month: "short" });
}

function TrendPill({ cur, prev }: { cur: number | null; prev: number | null }) {
  const t = trend(cur, prev);
  return <span className={`pill pill-${t.kind}`}>{t.label}</span>;
}

function Kpi({
  kind, value, label, note, cur, prev,
}: {
  kind: "eye" | "dollar" | "trend" | "users";
  value: string;
  label: string;
  note: string;
  cur?: number | null;
  prev?: number | null;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-icon">{icon(kind)}</div>
      {cur !== undefined ? <TrendPill cur={cur ?? null} prev={prev ?? null} /> : null}
      <div className="kpi-value num">{value}</div>
      <div className="kpi-label kicker">{label}</div>
      <div className="kpi-note">{note}</div>
    </div>
  );
}

function sourceBadge(b: ChannelBlock | undefined) {
  if (!b) return null;
  if (b.source === "live") return <span className="live-badge">Live · YouTube</span>;
  if (b.source === "csv") return <span className="live-badge">CSV · Studio</span>;
  return <span className="warn-badge">No data</span>;
}

export default function Dashboard() {
  const [page, setPage] = useState<Page>("home");
  const [current, setCurrent] = useState<string>("all");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [shown, setShown] = useState<Set<string>>(() => new Set(CHANNELS.map((c) => c.id)));
  const [range, setRange] = useState<RangeState>({ key: "28d", start: "", end: "" });
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [blocks, setBlocks] = useState<Record<string, ChannelBlock>>({});
  const [rangeMeta, setRangeMeta] = useState<RangeResolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [ytNote, setYtNote] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const today = deskTodayStr(now);
  const months = useMemo(() => monthOptions(now), [now]);

  const load = useCallback(async (r: RangeState, refresh = false) => {
    setLoading(true);
    setBanner(null);
    const params = new URLSearchParams({ range: r.key });
    if (r.key === "custom") {
      params.set("start", r.start);
      params.set("end", r.end);
    }
    if (refresh) params.set("refresh", "1");
    try {
      const [anRes, imRes] = await Promise.all([
        fetch("/api/analytics?" + params.toString(), { cache: "no-store" }),
        fetch("/api/imports?" + params.toString(), { cache: "no-store" }),
      ]);
      const an = (await anRes.json()) as {
        ok: boolean; error?: string | null; range?: RangeResolved; byChannel?: Record<string, ChannelBlock>;
      };
      const im = (await imRes.json()) as {
        ok: boolean; error?: string | null; byChannel?: Record<string, ChannelBlock>;
      };
      const next: Record<string, ChannelBlock> = { ...(im.byChannel || {}) };
      if (an.ok && an.byChannel) {
        if (an.byChannel.oplol) next.oplol = an.byChannel.oplol;
      } else {
        const err = an.error || "YouTube Analytics is not available.";
        setYtNote(err);
        next.oplol = {
          channelId: "oplol",
          youtubeChannelId: CHANNELS[0].youtubeChannelId,
          source: "none",
          ok: false,
          series: [],
          note: err,
          error: err,
        };
      }
      if (an.ok) setYtNote(an.byChannel?.oplol?.note || null);
      setBlocks(next);
      if (an.range) setRangeMeta(an.range);
    } catch {
      setBanner("Could not load metrics. The APIs did not respond.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const s = customStart || "";
    const e = customEnd || today;
    if (!customStart) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - 27);
      setCustomStart(today.slice(0, 8) + String(Math.max(1, Number(today.slice(8)) - 27)).padStart(2, "0"));
    }
    if (!customEnd) setCustomEnd(today);
    void load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeLabel = rangeMeta?.label || (range.key === "28d" ? "Last 28 days" : range.key);

  function seriesFor(id: string): DailyPoint[] {
    if (id === "all") return combine(CHANNELS.map((c) => blocks[c.id]).filter(Boolean));
    return blocks[id]?.series || [];
  }

  function blockFor(id: string): ChannelBlock | undefined {
    return blocks[id];
  }

  function toggleCh(id: string) {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return next;
        next.delete(id);
      } else next.add(id);
      return next;
    });
  }

  async function onRangeChange(key: string) {
    const next = { ...range, key };
    setRange(next);
    if (key === "custom") return;
    await load(next);
  }

  async function applyCustom() {
    const next = { key: "custom", start: customStart, end: customEnd };
    setRange(next);
    await load(next);
  }

  async function onUpload(channel: string, file: File | null) {
    if (!file) return;
    setUploading(channel);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.set("channel", channel);
      fd.set("file", file);
      const res = await fetch("/api/imports", { method: "POST", body: fd });
      const json = (await res.json()) as { ok: boolean; error?: string; rows?: number; file?: string };
      if (!json.ok) {
        setUploadMsg(json.error || "Upload failed.");
        return;
      }
      setUploadMsg(`Stored ${json.file} · ${json.rows ?? 0} daily rows. Reloading…`);
      await load(range, true);
    } catch {
      setUploadMsg("Upload request failed.");
    } finally {
      setUploading(null);
    }
  }

  const overlayChannels = CHANNELS.filter((c) => shown.has(c.id));
  const overlayShown = overlayChannels.length ? overlayChannels : CHANNELS;
  const overlayDates = (() => {
    const set = new Set<string>();
    overlayShown.forEach((c) => seriesFor(c.id).forEach((r) => { if (r.date) set.add(r.date.slice(0, 10)); }));
    return [...set].sort();
  })();

  const combined = seriesFor("all");
  const viewsAll = rangeSums(combined, "views");
  const revAll = rangeSums(combined, "revenue");
  const rpmAll = rangeSums(combined, "rpm");
  const reporting = CHANNELS.filter((c) => (blocks[c.id]?.series || []).length > 0).length;

  const emptyCopy = (ch: Channel | null) => {
    if (loading) return "Loading…";
    if (!ch || ch.id === "oplol" || current === "all") {
      if (ytNote && current !== "eventvods" && current !== "onivia") return ytNote;
    }
    if (ch && ch.source === "csv") {
      const b = blocks[ch.id];
      return b?.note || `No Studio CSV for ${ch.alias} yet. Upload a daily export (Date, views, estimated revenue).`;
    }
    return "No live or CSV series. Numbers are not invented.";
  };

  const chObj: Channel | { id: "all"; name: string; alias: string; url: string; color: string } =
    current === "all"
      ? { id: "all", name: "All channels", alias: CHANNELS.map(shortName).join(" · "), url: "", color: "#1e3b2f" }
      : CHANNELS.find((c) => c.id === current) || CHANNELS[0];

  const chSeries = seriesFor(current === "all" ? "all" : chObj.id);
  const chViews = rangeSums(chSeries, "views");
  const chRev = rangeSums(chSeries, "revenue");
  const chRpm = rangeSums(chSeries, "rpm");
  const chLabels = chSeries.map((r) => shortLabel(r.date));

  function fmtTick(m: Metric, v: number) {
    if (m === "views") return fmtK(v);
    if (m === "rpm") return "$" + (Number.isFinite(v) ? v.toFixed(2) : "—");
    const sign = v < 0 ? "−" : "";
    return sign + "$" + fmtK(Math.abs(v));
  }
  function fmtTip(m: Metric, v: number) {
    if (m === "views") return fmtInt(v);
    return fmtUSD(v);
  }

  let overlayFoot = "";
  if (metric === "rpm") {
    let rev = 0, views = 0, any = false;
    overlayShown.forEach((c) => {
      seriesFor(c.id).forEach((r) => {
        if (r.revenue != null) { rev += r.revenue; any = true; }
        if (r.views) views += r.views;
      });
    });
    overlayFoot = any && views ? `${fmtUSD((rev / views) * 1000)} blended RPM · ${rangeLabel}` : "";
  } else {
    let sum = 0, any = false;
    overlayShown.forEach((c) => {
      const r = rangeSums(seriesFor(c.id), metric);
      if (r.cur != null) { sum += r.cur; any = true; }
    });
    if (any) {
      overlayFoot = `${metric === "views" ? fmtK(sum) : fmtUSD0(sum)} ${metric === "revenue" ? "sum of estimated revenue" : "sum of views"} · ${rangeLabel}`;
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <div className="brand-name">LoL Network</div>
            <div className="brand-sub">Channel desk</div>
          </div>
        </div>
        <p className="nav-kicker">Desk</p>
        <nav className="nav">
          <button className="nav-item" aria-current={page === "home" ? "page" : undefined} onClick={() => setPage("home")}>
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Network
          </button>
          <button className="nav-item" aria-current={page === "channel" ? "page" : undefined} onClick={() => setPage("channel")}>
            <svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
            Channel
          </button>
          <button className="nav-item" aria-current={page === "imports" ? "page" : undefined} onClick={() => setPage("imports")}>
            <svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 19h16"/></svg>
            CSV import
          </button>
        </nav>
        <div className="side-note">
          <div className="side-note-title">100% network</div>
          <p>Views, estimated revenue USD, RPM. No ownership split. OPLOLReplay can be live later; Eventvods and Onivia use Studio CSV until Owner.</p>
        </div>
        <div className="side-user">
          <div className="avatar">I</div>
          <div><b>Network</b><span>{TIMEZONE_LABEL}</span></div>
        </div>
      </aside>

      <main className="desk">
        <header className="desk-header">
          <div>
            <div className="kicker">{fullDateFmt.format(now)} · {TIMEZONE_LABEL}</div>
            <h1>{greeting(now)}</h1>
          </div>
          <div className="header-tools">
            <div className="range-wrap">
              <label className="muted" htmlFor="range-select" style={{ fontSize: 12.5 }}>Range</label>
              <select id="range-select" value={range.key} onChange={(e) => void onRangeChange(e.target.value)} aria-label="Date range">
                <option value="28d">Last 28 days</option>
                <option value="90d">Last 90 days</option>
                <option value="365d">Last 365 days</option>
                <option disabled>──────────</option>
                {months.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
                <option disabled>──────────</option>
                <option value="custom">Custom…</option>
              </select>
              {range.key === "custom" ? (
                <span>
                  <input type="date" max={today} value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="From" />
                  <input type="date" max={today} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="To" />
                  <button className="btn" type="button" onClick={() => void applyCustom()}>Apply</button>
                </span>
              ) : null}
              <button className="btn" type="button" disabled={loading} onClick={() => void load(range, true)}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button className="btn" type="submit">Sign out</button>
            </form>
          </div>
        </header>

        {banner ? <div className="page" style={{ paddingBottom: 0 }}><div className="banner warn">{banner}</div></div> : null}

        {page === "home" ? (
          <section className="page">
            <div className="grid-4">
              <Kpi kind="eye" value={fmtK(viewsAll.cur)} label={`Views · ${rangeLabel}`} note="Combined 100% network" cur={viewsAll.cur} prev={viewsAll.prev} />
              <Kpi kind="dollar" value={fmtUSD0(revAll.cur)} label={`Est. revenue · ${rangeLabel}`} note="USD · YouTube estimated revenue" cur={revAll.cur} prev={revAll.prev} />
              <Kpi kind="trend" value={fmtUSD(rpmAll.cur)} label={`Blended RPM · ${rangeLabel}`} note="Revenue per 1,000 views" cur={rpmAll.cur} prev={rpmAll.prev} />
              <Kpi kind="users" value={`${reporting} / ${CHANNELS.length}`} label="Channels reporting" note={loading ? "Loading…" : reporting ? "Live and/or CSV for this range" : "Empty until live API or real CSV"} />
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Compare channels</h3>
                  <div className="sub">{rangeLabel} · 100% network · {overlayShown.map(shortName).join(" · ")}</div>
                </div>
                <div className="head-actions">
                  <div className="seg" role="group" aria-label="Channels on the chart">
                    {CHANNELS.map((c) => (
                      <button key={c.id} className="seg-opt" data-ch={c.id} aria-pressed={shown.has(c.id)} onClick={() => toggleCh(c.id)}>
                        {shortName(c)}
                      </button>
                    ))}
                  </div>
                  <div className="seg" role="group" aria-label="Metric">
                    {(["revenue", "views", "rpm"] as Metric[]).map((m) => (
                      <button key={m} className="seg-opt" aria-pressed={metric === m} onClick={() => setMetric(m)}>
                        {m === "revenue" ? "Revenue" : m === "views" ? "Views" : "RPM"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Chart
                tall
                labels={overlayDates.map(shortLabel)}
                series={overlayShown.map((c) => ({
                  name: shortName(c),
                  color: c.color,
                  values: overlayDates.map((d) => {
                    const row = seriesFor(c.id).find((r) => r.date.slice(0, 10) === d);
                    return metricOf(row, metric);
                  }),
                }))}
                formatTick={(v) => fmtTick(metric, v)}
                formatTip={(v) => fmtTip(metric, v)}
                empty={<EmptyChart>{loading ? "Loading…" : "No daily series for this range. Empty until live Analytics or a real Studio CSV."}</EmptyChart>}
              />
              <div className="legend">
                {CHANNELS.map((c) => (
                  <span key={c.id} data-ch={c.id} className={shown.has(c.id) ? "on" : ""} onClick={() => toggleCh(c.id)}>
                    <i style={{ background: c.color }} />{shortName(c)}
                  </span>
                ))}
              </div>
              <div className="chart-foot">
                {overlayFoot ? <div><span className="big">{overlayFoot.split(" ")[0]}</span> <span>{overlayFoot.slice(overlayFoot.indexOf(" ") + 1)}</span></div> : null}
              </div>
            </div>

            <div className="page-intro">
              <h2>Channels</h2>
              <span className="muted">Allowlist only · 100% channel metrics · {TIMEZONE_LABEL}</span>
            </div>
            <div className="grid-3">
              {CHANNELS.map((c) => {
                const s = seriesFor(c.id);
                const v = rangeSums(s, "views");
                const r = rangeSums(s, "revenue");
                const p = rangeSums(s, "rpm");
                const b = blockFor(c.id);
                return (
                  <article className="card channel-card" key={c.id}>
                    <div>
                      <div className="kicker" style={{ marginBottom: 6 }}>{c.alias}</div>
                      <h3 className="title">{c.name}</h3>
                      <a className="link" href={c.url} target="_blank" rel="noopener">{c.url.replace("https://www.", "")}</a>
                      <div style={{ marginTop: 8 }}>{sourceBadge(b)}</div>
                    </div>
                    <div className="stat-row">
                      <div className="stat"><div className="kicker">Views</div><div className="num">{fmtK(v.cur)}</div><small>{rangeLabel}</small></div>
                      <div className="stat"><div className="kicker">Est. revenue</div><div className="num">{fmtUSD0(r.cur)}</div><small>USD</small></div>
                      <div className="stat"><div className="kicker">RPM</div><div className="num">{fmtUSD(p.cur)}</div><small>per 1,000 views</small></div>
                      <div className="stat"><div className="kicker">Source</div><div className="num" style={{ fontSize: 16 }}>{c.source === "youtube-analytics" ? "Live API" : "CSV"}</div><small>{b?.note || (c.source === "csv" ? "Until Owner Analytics" : "When Google env is set")}</small></div>
                    </div>
                    <div className="actions">
                      <button className="btn btn-primary" type="button" onClick={() => { setCurrent(c.id); setPage("channel"); }}>Open detail</button>
                      <a className="btn" href={c.url} target="_blank" rel="noopener">YouTube ↗</a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {page === "channel" ? (
          <section className="page">
            <div className="page-intro">
              <div>
                <div className="kicker">{current === "all" ? "Network" : "Channel"}</div>
                <h2>{chObj.name}</h2>
                {chObj.url ? <a className="link" href={chObj.url} target="_blank" rel="noopener">{chObj.url}</a> : <div className="muted">{chObj.alias}</div>}
              </div>
              <div className="filters">
                <label className="muted" htmlFor="ch-select" style={{ fontSize: 12.5 }}>Channel</label>
                <select id="ch-select" value={current} onChange={(e) => setCurrent(e.target.value)}>
                  <option value="all">All</option>
                  {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {current === "all" ? <span className="live-badge">Combined</span> : sourceBadge(blockFor(current))}
              </div>
            </div>
            <div className="grid-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <Kpi kind="dollar" value={fmtUSD0(chRev.cur)} label={`Revenue, 100% · ${rangeLabel}`} note={current === "all" ? "Combined estimated revenue" : emptyCopy(current === "all" ? null : CHANNELS.find((c) => c.id === current) || null)} cur={chRev.cur} prev={chRev.prev} />
              <Kpi kind="eye" value={fmtK(chViews.cur)} label={`Views · ${rangeLabel}`} note="Not split" cur={chViews.cur} prev={chViews.prev} />
              <Kpi kind="trend" value={fmtUSD(chRpm.cur)} label={`RPM, 100% · ${rangeLabel}`} note="Revenue per 1,000 views" cur={chRpm.cur} prev={chRpm.prev} />
            </div>
            <div className="chart-grid">
              {(["revenue", "views", "rpm"] as Metric[]).map((m) => (
                <div className="card" key={m}>
                  <div className="card-head">
                    <div>
                      <h3>{m === "revenue" ? "Revenue" : m === "views" ? "Views" : "RPM"}</h3>
                      <div className="sub">100% channel{current === "all" ? " · combined" : ""}</div>
                    </div>
                  </div>
                  <Chart
                    labels={chLabels}
                    series={[{
                      name: chObj.name,
                      color: "color" in chObj ? chObj.color : "#1e3b2f",
                      values: chSeries.map((r) => metricOf(r, m)),
                    }]}
                    formatTick={(v) => fmtTick(m, v)}
                    formatTip={(v) => fmtTip(m, v)}
                    empty={<EmptyChart>{emptyCopy(current === "all" ? null : CHANNELS.find((c) => c.id === current) || null)}</EmptyChart>}
                  />
                  <div className="chart-foot">
                    <div>
                      <span className="big">{m === "views" ? fmtK(rangeSums(chSeries, m).cur) : m === "rpm" ? fmtUSD(rangeSums(chSeries, m).cur) : fmtUSD0(rangeSums(chSeries, m).cur)}</span>
                      <span> {rangeLabel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Daily table</h3>
                  <div className="sub">Last rows in range · 100% network · USD</div>
                </div>
              </div>
              <div className="table-wrap">
                {chSeries.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="r">Views</th>
                        <th className="r">Est. revenue</th>
                        <th className="r">RPM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chSeries.slice().reverse().slice(0, 31).map((r) => (
                        <tr key={r.date}>
                          <td>{dateFmt.format(new Date(r.date + "T12:00:00"))}</td>
                          <td className="r num">{fmtInt(r.views)}</td>
                          <td className="r num">{fmtUSD(r.revenue)}</td>
                          <td className="r num">{fmtUSD(r.rpm ?? rpmOf(r.views, r.revenue))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty">{emptyCopy(current === "all" ? null : CHANNELS.find((c) => c.id === current) || null)}</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {page === "imports" ? (
          <section className="page">
            <div className="page-intro">
              <div>
                <h2>CSV import</h2>
                <div className="muted">Eventvods and Onivia · YouTube Studio daily export · {TIMEZONE_LABEL}</div>
              </div>
            </div>
            <div className="banner">
              OPLOLReplay uses the live Analytics API when Google env vars are set. Do not upload example or SAMPLE numbers — EXAMPLE files are ignored.
            </div>
            {uploadMsg ? <div className="banner">{uploadMsg}</div> : null}
            <div className="grid-2">
              {CHANNELS.filter((c) => c.source === "csv").map((c) => {
                const b = blockFor(c.id);
                return (
                  <div className="card" key={c.id}>
                    <div className="card-head">
                      <div>
                        <h3>{c.alias}</h3>
                        <div className="sub">{c.youtubeChannelId}</div>
                      </div>
                      {sourceBadge(b)}
                    </div>
                    <p className="muted" style={{ marginTop: 0 }}>{b?.note}</p>
                    {b?.file ? <p className="muted">File: <code>{b.file}</code>{b.uploadedAt ? ` · ${b.uploadedAt}` : ""}{b.series?.length ? ` · ${b.series.length} rows in range` : ""}</p> : null}
                    <div className="drop">
                      <div className="kicker">Upload Studio CSV</div>
                      <input
                        type="file"
                        accept=".csv,.tsv,.txt"
                        disabled={uploading === c.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          void onUpload(c.id, f);
                          e.target.value = "";
                        }}
                      />
                      <div className="muted">Headers: Date, views, estimated revenue (USD). Filename should include {c.alias.toLowerCase()}.</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card">
              <div className="card-head"><div><h3>CSV format</h3><div className="sub">YouTube Studio → Advanced mode → export daily</div></div></div>
              <pre style={{ margin: 0, fontSize: 13, overflow: "auto" }}>{`Date,Views,Estimated revenue (USD)
2026-08-01,12345,67.89
2026-08-02,11001,54.10`}</pre>
              <p className="muted">That sample above is format only — it is not loaded into the desk. Empty until a real file is parsed.</p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
