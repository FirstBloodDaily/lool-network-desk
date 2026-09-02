"use client";

import { useEffect, useRef, useState } from "react";

export type Series = {
  name: string;
  color: string;
  values: (number | null)[];
};

type TipItem = { name: string; color: string; value: number };

function fmtDefault(v: number): string {
  return String(Math.round(v));
}

export function EmptyChart({ children }: { children: React.ReactNode }) {
  return <div className="empty-chart">{children}</div>;
}

export default function Chart({
  labels,
  series,
  formatTick,
  formatTip,
  empty,
  tall,
}: {
  labels: string[];
  series: Series[];
  formatTick?: (v: number) => string;
  formatTip?: (v: number) => string;
  empty?: React.ReactNode;
  tall?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [tip, setTip] = useState<{ x: number; y: number; label: string; items: TipItem[]; flipLeft?: boolean } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 640));
    ro.observe(el);
    setW(el.clientWidth || 640);
    return () => ro.disconnect();
  }, []);

  const tick = formatTick || fmtDefault;
  const tipFmt = formatTip || tick;
  const allVals: number[] = [];
  series.forEach((s) => (s.values || []).forEach((v) => { if (v != null && Number.isFinite(v)) allVals.push(v); }));
  const n = labels.length;

  if (!n || !allVals.length) {
    return <div className={`chart ${tall ? "tall" : ""}`}>{empty || <EmptyChart>No data for this range.</EmptyChart>}</div>;
  }

  const H = tall ? 340 : 240;
  const padL = 58, padR = 18, padT = 14, padB = 32;
  const innerW = Math.max(w - padL - padR, 40);
  const innerH = H - padT - padB;
  let min = Math.min(0, ...allVals);
  let max = Math.max(...allVals);
  if (max === min) max = min + 1;
  const pad = (max - min) * 0.08;
  max += pad;
  if (min < 0) min -= pad;
  const x = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + ((max - v) / (max - min)) * innerH;
  const ticks = 4;
  const step = Math.max(1, Math.ceil(n / 6));

  function onMove(ev: React.MouseEvent<SVGSVGElement>) {
    const svg = ev.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / Math.max(rect.width, 1)) * w;
    let best = 0, bestD = 1e9;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    const items = series
      .map((s) => {
        const v = s.values[best];
        if (v == null || !Number.isFinite(v)) return null;
        return { name: s.name, color: s.color, value: v };
      })
      .filter((x): x is TipItem => !!x);
    if (!items.length) { setTip(null); return; }
    const flipLeft = n > 1 && best >= Math.max(n - 4, Math.floor(n * 0.72));
    setTip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, label: labels[best], items, flipLeft });
  }

  return (
    <div className={`chart ${tall ? "tall" : ""}`} ref={wrap}>
      <svg width={w} height={H} onMouseMove={onMove} onMouseLeave={() => setTip(null)}>
        {Array.from({ length: ticks + 1 }, (_, t) => {
          const v = min + ((max - min) * t) / ticks;
          return (
            <g key={t}>
              <line className="grid-line" x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} />
              <text className="axis" x={padL - 8} y={y(v) + 4} textAnchor="end">{tick(v)}</text>
            </g>
          );
        })}
        {min < 0 ? <line className="zero" x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} /> : null}
        {(() => {
          const idxs: number[] = [];
          for (let i = 0; i < n; i++) if (i % step === 0) idxs.push(i);
          if (n > 1 && idxs[idxs.length - 1] !== n - 1) idxs.push(n - 1);
          if (idxs.length >= 2 && idxs[idxs.length - 1] - idxs[idxs.length - 2] < 3) idxs.splice(idxs.length - 2, 1);
          return idxs.map((i) => (
            <text key={i} className="axis" x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{labels[i]}</text>
          ));
        })()}
        {series.map((s) => {
          let d = "", started = false;
          const dots: React.ReactNode[] = [];
          s.values.forEach((v, i) => {
            if (v == null || !Number.isFinite(v)) return;
            const px = x(i), py = y(v);
            d += (started ? "L" : "M") + px.toFixed(1) + "," + py.toFixed(1);
            started = true;
            dots.push(<circle key={i} className="hover-dot" cx={px} cy={py} r={4} opacity={0} fill={s.color} />);
          });
          if (!d) return null;
          return (
            <g key={s.name}>
              <path fill="none" strokeWidth={1.75} stroke={s.color} d={d} />
              {dots}
            </g>
          );
        })}
        {tip ? <line className="hover-rule" x1={x(labels.indexOf(tip.label))} x2={x(labels.indexOf(tip.label))} y1={padT} y2={H - padB} /> : null}
      </svg>
      {tip ? (
        <div className={"chart-tip" + (tip.flipLeft ? " chart-tip-left" : "")} style={{ left: tip.x, top: tip.y, transform: tip.flipLeft ? "translate(calc(-100% - 10px), -110%)" : "translate(8px, -110%)" }}>
          <div className="tip-date">{tip.label}</div>
          {tip.items.map((it) => (
            <div className="tip-row" key={it.name}>
              <span className="tip-name"><i className="tip-swatch" style={{ background: it.color }} />{it.name}</span>
              <span className="tip-val">{tipFmt(it.value)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
