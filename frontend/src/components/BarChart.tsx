import { useState } from 'react';

interface Props {
  label: string;
  points: { key: string; label: string; value: number; partial?: boolean }[];
  format?: (v: number) => string;
  max?: number;
}

/** Single-series bar chart. One scale for bars, ticks and labels. Hover or focus a bar for its value. */
export function BarChart({ label, points, format = String, max }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 200, L = 36, R = 8, T = 14, B = 26;
  const top = max ?? niceMax(Math.max(1, ...points.map((p) => p.value)));
  const ticks = [0, top / 2, top];
  const slot = (W - L - R) / points.length;
  const bw = Math.min(44, slot * 0.56);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">{format(t)}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = L + slot * i + (slot - bw) / 2;
          const h = Math.max(0, y(0) - y(p.value));
          const r = Math.min(4, h / 2);
          return (
            <g key={p.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${p.label}: ${format(p.value)}`}>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" />
              <path
                d={`M${x},${y(0)} V${y(p.value) + r} Q${x},${y(p.value)} ${x + r},${y(p.value)} H${x + bw - r} Q${x + bw},${y(p.value)} ${x + bw},${y(p.value) + r} V${y(0)} Z`}
                className={`bar${p.partial ? ' partial' : ''}${hover === i ? ' on' : ''}`}
              />
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="axis">{p.label}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="base" />
      </svg>
      {hover != null && (
        <div className="tip" style={{ left: `${((L + slot * hover + slot / 2) / W) * 100}%`, top: `${(y(points[hover].value) / H) * 100}%` }}>
          <b>{format(points[hover].value)}</b> {points[hover].label}{points[hover].partial ? ' (so far)' : ''}
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}
