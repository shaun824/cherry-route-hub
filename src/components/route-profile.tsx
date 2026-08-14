// Interactive elevation profile for a route. Loads the route's KML file(s),
// builds a distance/elevation series (from KML altitudes when present, otherwise
// from the terrain lookup server function) and draws a hoverable SVG chart.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mountain, TrendingUp } from "lucide-react";
import {
  gainFromSeries,
  haversineMeters,
  parseKml,
  smoothElevations,
  type LatLngAlt,
} from "@/lib/geo";

import { getRouteElevation } from "@/lib/elevation.functions";
import type { EventRoute } from "@/lib/mock-data";

type Point = { km: number; ele: number };

/** Cumulative distance (km) at every coordinate, at full resolution. */
function cumulativeKm(coords: LatLngAlt[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + haversineMeters(coords[i - 1], coords[i]) / 1000);
  }
  return out;
}

/** Down-samples a full-resolution series for drawing, keeping true distances. */
function forDisplay(series: Point[], max = 300): Point[] {
  if (series.length <= max) return series;
  const step = series.length / max;
  const out: Point[] = [];
  for (let i = 0; i < max; i++) out.push(series[Math.floor(i * step)]);
  out.push(series[series.length - 1]);
  return out;
}

function totalGain(series: Point[]): number {
  return gainFromSeries(
    smoothElevations(
      series.map((p) => p.ele),
      series.map((p) => p.km * 1000),
    ),
  );
}


export function RouteProfile({ route, color }: { route: EventRoute; color?: string }) {
  const kmls = route.kmlUrls ?? [];
  const [series, setSeries] = useState<Point[] | null>(null);
  const [gain, setGain] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const fetchElev = useServerFn(getRouteElevation);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (kmls.length === 0) return;
    let cancelled = false;
    (async () => {
      const merged: LatLngAlt[] = [];
      for (const url of kmls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const layer = parseKml(await res.text());
          for (const line of layer.lines) merged.push(...line);
        } catch {
          /* ignore */
        }
      }
      if (cancelled || merged.length < 2) {
        if (!cancelled) setFailed(true);
        return;
      }
      const km = cumulativeKm(merged);
      const hasAlt = merged.some(
        (c) => typeof c[2] === "number" && Number.isFinite(c[2]) && c[2] !== 0,
      );
      if (hasAlt) {
        const full: Point[] = [];
        for (let i = 0; i < merged.length; i++) {
          const ele = merged[i][2];
          if (typeof ele === "number" && Number.isFinite(ele)) full.push({ km: km[i], ele });
        }
        setGain(totalGain(full));
        setSeries(forDisplay(full));
        return;
      }
      // No altitude in the file — look up terrain elevation for sampled points,
      // keeping each sample's true along-route distance.
      const maxPts = 200;
      const idx: number[] = [];
      const step = Math.max(1, merged.length / maxPts);
      for (let i = 0; i < merged.length; i += step) idx.push(Math.floor(i));
      if (idx[idx.length - 1] !== merged.length - 1) idx.push(merged.length - 1);
      try {
        const res = await fetchElev({
          data: { coords: idx.map((i) => [merged[i][0], merged[i][1]] as [number, number]) },
        });
        if (cancelled) return;
        if (res.available && res.profile) {
          const pts = idx.map((i, n) => ({ km: km[i], ele: res.profile[n] }));
          setGain(totalGain(pts));
          setSeries(pts);
        } else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmls.join("|")]);


  const chart = useMemo(() => {
    if (!series || series.length < 2) return null;
    const W = 640;
    const H = 160;
    const pad = { t: 10, r: 6, b: 18, l: 30 };
    const maxKm = series[series.length - 1].km || 1;
    const minEle = Math.min(...series.map((p) => p.ele));
    const maxEle = Math.max(...series.map((p) => p.ele));
    const span = Math.max(maxEle - minEle, 20);
    const x = (km: number) => pad.l + (km / maxKm) * (W - pad.l - pad.r);
    const y = (ele: number) => pad.t + (1 - (ele - minEle) / span) * (H - pad.t - pad.b);
    const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.km).toFixed(1)},${y(p.ele).toFixed(1)}`).join(" ");
    const area = `${line} L${x(maxKm).toFixed(1)},${H - pad.b} L${pad.l},${H - pad.b} Z`;
    return { W, H, pad, maxKm, minEle, maxEle, x, y, line, area };
  }, [series]);

  if (kmls.length === 0) return null;

  if (failed) {
    return (
      <p className="mt-3 text-[11px] text-ink-soft">Route profile is unavailable right now.</p>
    );
  }

  if (!series || !chart) {
    return <div className="mt-3 h-[160px] animate-pulse rounded-xl bg-secondary/50" />;
  }

  const stroke = color || route.color || "#b91c1c";
  const climbM = gain ?? totalGain(series);
  const hoverPoint = hover !== null ? series[hover] : null;

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const px = ratio * chart.W;
    const km = ((px - chart.pad.l) / (chart.W - chart.pad.l - chart.pad.r)) * chart.maxKm;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < series.length; i++) {
      const d = Math.abs(series[i].km - km);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  return (
    <div className="mt-3 rounded-xl bg-secondary/40 p-3 ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Route profile</p>
        <div className="flex gap-3 text-[11px] font-semibold text-ink">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-cherry" />
            {climbM.toLocaleString("en-ZA")} m climbing
          </span>
          <span className="inline-flex items-center gap-1">
            <Mountain className="h-3.5 w-3.5 text-cherry" />
            {Math.round(chart.maxEle).toLocaleString("en-ZA")} m high point
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${chart.W} ${chart.H}`}
        className="mt-2 w-full touch-none"
        role="img"
        aria-label={`Elevation profile for ${route.name}`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
      >
        <defs>
          <linearGradient id={`rp-${route.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((f) => {
          const ele = chart.minEle + f * (chart.maxEle - chart.minEle);
          const yy = chart.y(ele);
          return (
            <g key={f}>
              <line
                x1={chart.pad.l}
                x2={chart.W - chart.pad.r}
                y1={yy}
                y2={yy}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
              />
              <text x={2} y={yy + 3} className="fill-current text-ink-soft" fontSize="9">
                {Math.round(ele)}
              </text>
            </g>
          );
        })}

        <path d={chart.area} fill={`url(#rp-${route.id})`} />
        <path d={chart.line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />

        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text
            key={f}
            x={chart.x(chart.maxKm * f)}
            y={chart.H - 5}
            textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
            className="fill-current text-ink-soft"
            fontSize="9"
          >
            {(chart.maxKm * f).toFixed(f === 0 ? 0 : 1)} km
          </text>
        ))}

        {hoverPoint ? (
          <g>
            <line
              x1={chart.x(hoverPoint.km)}
              x2={chart.x(hoverPoint.km)}
              y1={chart.pad.t}
              y2={chart.H - chart.pad.b}
              stroke={stroke}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={chart.x(hoverPoint.km)} cy={chart.y(hoverPoint.ele)} r="4" fill={stroke} />
          </g>
        ) : null}
      </svg>

      <p className="mt-1 text-[11px] font-semibold text-ink">
        {hoverPoint
          ? `${hoverPoint.km.toFixed(1)} km · ${Math.round(hoverPoint.ele)} m`
          : "Hover or drag across the profile to read distance and altitude"}
      </p>
    </div>
  );
}
