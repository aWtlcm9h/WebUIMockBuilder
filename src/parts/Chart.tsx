import { useEffect, useRef, useState } from 'react';
import type { Props } from '../model/types';
import { list, rng } from './common';

// 色はテーマ（ライト/ダーク）に追従させるため CSS 変数で指定する。SVG では style 経由で渡す
const SHADES = ['var(--wf-c1)', 'var(--wf-c2)', 'var(--wf-c3)', 'var(--wf-c4)', 'var(--wf-c5)'];
const DASH = ['', '6 3', '2 3', '10 4', ''];

export function sampleSeries(p: Props): number[][] {
  const r = rng(Number(p.seed) || 1);
  const names = list(p.series);
  const n = Math.max(2, Number(p.points) || 8);
  return names.map((_, si) => {
    let v = 30 + r() * 40;
    return Array.from({ length: n }, () => {
      v = Math.max(5, Math.min(100, v + (r() - 0.45) * 25 - si * 2));
      return Math.round(v);
    });
  });
}

export function ChartView({ p }: { p: Props }) {
  const type = String(p.chartType);
  const names = list(p.series);
  const data = sampleSeries(p);
  // 実際の表示サイズで描画する（引き伸ばしによる円や文字の歪みを防ぐ）
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 200 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 0 && h > 0) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(80, size.w);
  const H = Math.max(60, size.h);
  const pad = { l: 28, r: 8, t: 8, b: 20 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = data[0]?.length ?? 0;
  const xs = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const ys = (v: number) => pad.t + ih - (v / 100) * ih;

  let body: JSX.Element;
  if (type === 'pie' || type === 'donut') {
    const vals = (data[0] ?? []).slice(0, Math.max(2, Math.min(6, n)));
    const total = vals.reduce((a, b) => a + b, 0);
    let a0 = -Math.PI / 2;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.max(10, Math.min(W, H) / 2 - 6);
    body = (
      <g>
        {vals.map((v, i) => {
          const a1 = a0 + (v / total) * Math.PI * 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = `M${cx},${cy} L${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} A${R},${R} 0 ${large} 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)} Z`;
          a0 = a1;
          return <path key={i} d={d} style={{ fill: SHADES[i % SHADES.length], stroke: 'var(--wf-surface)' }} strokeWidth={2} />;
        })}
        {type === 'donut' && <circle cx={cx} cy={cy} r={R * 0.55} style={{ fill: 'var(--wf-surface)' }} />}
      </g>
    );
  } else {
    const grid = [0, 25, 50, 75, 100].map((v) => (
      <g key={v}>
        <line x1={pad.l} x2={W - pad.r} y1={ys(v)} y2={ys(v)} style={{ stroke: 'var(--wf-fill2)' }} />
        <text x={pad.l - 4} y={ys(v) + 3} fontSize={8} textAnchor="end" style={{ fill: 'var(--wf-muted)' }}>
          {v}
        </text>
      </g>
    ));
    let marks: JSX.Element[];
    if (type === 'bar') {
      const groupW = iw / n;
      const bw = (groupW * 0.7) / data.length;
      marks = data.flatMap((s, si) =>
        s.map((v, i) => (
          <rect
            key={`${si}-${i}`}
            x={pad.l + i * groupW + groupW * 0.15 + si * bw}
            y={ys(v)}
            width={bw - 1}
            height={pad.t + ih - ys(v)}
            style={{ fill: SHADES[si % SHADES.length] }}
          />
        )),
      );
    } else if (type === 'scatter') {
      marks = data.flatMap((s, si) =>
        s.map((v, i) => <circle key={`${si}-${i}`} cx={xs(i)} cy={ys(v)} r={3} style={{ fill: SHADES[si % SHADES.length] }} />),
      );
    } else {
      marks = data.map((s, si) => {
        const pts = s.map((v, i) => `${xs(i)},${ys(v)}`).join(' ');
        return (
          <g key={si}>
            {type === 'area' && (
              <polygon
                points={`${xs(0)},${ys(0)} ${pts} ${xs(n - 1)},${ys(0)}`}
                style={{ fill: SHADES[si % SHADES.length] }}
                opacity={0.25}
              />
            )}
            <polyline points={pts} fill="none" style={{ stroke: SHADES[si % SHADES.length] }} strokeWidth={2} strokeDasharray={DASH[si % DASH.length]} />
          </g>
        );
      });
    }
    body = (
      <g>
        {grid}
        {marks}
        <line x1={pad.l} x2={W - pad.r} y1={ys(0)} y2={ys(0)} style={{ stroke: 'var(--wf-line)' }} />
      </g>
    );
  }

  return (
    <div className="wf-chart">
      {p.title && <div className="wf-chart-title">{String(p.title)}</div>}
      <div className="wf-chart-plot">
        {p.yLabel && type !== 'pie' && type !== 'donut' && <span className="wf-chart-ylabel">{String(p.yLabel)}</span>}
        <div className="wf-chart-svg" ref={boxRef}>
          <svg viewBox={`0 0 ${W} ${H}`}>{body}</svg>
        </div>
      </div>
      {p.xLabel && type !== 'pie' && type !== 'donut' && <div className="wf-chart-xlabel">{String(p.xLabel)}</div>}
      {p.legend && (
        <div className="wf-legend">
          {(type === 'pie' || type === 'donut' ? (data[0] ?? []).slice(0, 6).map((_, i) => `区分${i + 1}`) : names).map((nm, i) => (
            <span key={i}>
              <i style={{ background: SHADES[i % SHADES.length] }} />
              {nm}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
