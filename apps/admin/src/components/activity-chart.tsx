'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import type { DailyActivity } from '@/lib/analytics';

const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 24;

/** Smooth a polyline into a gentle bezier path (Catmull-Rom style). */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/**
 * Dependency-free SVG area chart of daily message activity: outbound sends
 * as a filled area (primary), inbound replies as a second line (signal
 * green). Colors come from CSS custom properties so both themes just work.
 */
export function ActivityChart({ data, height = 200 }: { data: DailyActivity[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { sentPts, sentArea, replyPts, yTicks, max } = useMemo(() => {
    const innerW = Math.max(0, width - PAD_L - PAD_R);
    const innerH = height - PAD_T - PAD_B;
    const max = Math.max(1, ...data.map((d) => Math.max(d.sent, d.replies)));
    // Round the axis top up to a friendly number so gridlines land on integers.
    const top = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
    const x = (i: number) => PAD_L + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
    const y = (v: number) => PAD_T + innerH - (v / top) * innerH;
    const sentPts: [number, number][]  = data.map((d, i) => [x(i), y(d.sent)]);
    const replyPts: [number, number][] = data.map((d, i) => [x(i), y(d.replies)]);
    const line = smoothPath(sentPts);
    const sentArea = line
      ? `${line} L ${sentPts[sentPts.length - 1][0]},${PAD_T + innerH} L ${sentPts[0][0]},${PAD_T + innerH} Z`
      : '';
    const yTicks = [0, top / 2, top].map((v) => ({ v, y: y(v) }));
    return { sentPts, sentArea, replyPts, yTicks, max: top };
  }, [data, width, height]);

  const hovered = hover !== null ? data[hover] : null;

  if (data.length === 0) return null;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Daily message activity" className="block">
          <defs>
            <linearGradient id="sent-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map(({ v, y }) => (
            <g key={v}>
              <line x1={PAD_L} x2={width - PAD_R} y1={y} y2={y} stroke="var(--border)" strokeDasharray={v === 0 ? undefined : '3 3'} strokeWidth="1" />
              <text x={PAD_L - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="10">
                {v}
              </text>
            </g>
          ))}

          <path d={sentArea} fill="url(#sent-fill)" />
          <path d={smoothPath(sentPts)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
          <path d={smoothPath(replyPts)} fill="none" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />

          {data.map((d, i) => (
            <text
              key={d.day}
              x={sentPts[i][0]}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              className="fill-muted-foreground"
              style={{ display: data.length > 8 && i % 2 !== 0 ? 'none' : undefined }}
            >
              {shortDay(d.day)}
            </text>
          ))}

          {hover !== null && (
            <g>
              <line x1={sentPts[hover][0]} x2={sentPts[hover][0]} y1={PAD_T} y2={height - PAD_B} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={sentPts[hover][0]} cy={sentPts[hover][1]} r="4" fill="var(--primary)" stroke="var(--background)" strokeWidth="2" />
              <circle cx={replyPts[hover][0]} cy={replyPts[hover][1]} r="3.5" fill="var(--signal)" stroke="var(--background)" strokeWidth="2" />
            </g>
          )}

          {/* invisible hover strips, one per day */}
          {data.map((d, i) => {
            const half = data.length > 1 ? (width - PAD_L - PAD_R) / (data.length - 1) / 2 : width / 2;
            return (
              <rect
                key={d.day}
                x={sentPts[i][0] - half}
                y={0}
                width={half * 2}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </svg>
      )}

      {hovered && hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(sentPts[hover][0] - 60, 0), width - 130),
            top: 0,
          }}
        >
          <div className="mb-1 font-medium">{shortDay(hovered.day)}</div>
          <div className="grid gap-0.5 tabular-nums">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Sent {hovered.sent}</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-signal" /> Replies {hovered.replies}</span>
            {hovered.failed > 0 && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" /> Failed {hovered.failed}</span>}
          </div>
        </div>
      )}

      <div className="absolute top-0 right-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> Sent</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-signal" /> Replies</span>
      </div>
      <span className="sr-only">Peak day value {max}</span>
    </div>
  );
}
