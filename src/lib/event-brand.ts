import type { CSSProperties } from "react";

/**
 * Event brand colours.
 *
 * `hero_color` on an event can be either:
 *  - a hex brand colour, e.g. "#c33622" (optionally "#c33622,#7c2015" for an
 *    explicit gradient pair) — sampled from the event's own logo, or
 *  - a legacy Tailwind gradient class pair, e.g. "from-cherry to-cherry-deep".
 *
 * Hex values are rendered through inline styles because Tailwind cannot compile
 * arbitrary class names that only exist in the database.
 */

const FALLBACK_CLASS = "bg-gradient-to-br from-cherry to-cherry-deep";

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(rgb: [number, number, number]) {
  return `#${rgb.map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Darken a hex colour by a factor (0-1). */
export function shade(hex: string, factor = 0.6): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex([rgb[0] * factor, rgb[1] * factor, rgb[2] * factor] as [number, number, number]);
}

/**
 * Returns the className + style needed to paint an event header in the event's
 * own brand colours. Always spread both onto the element.
 */
export function brandHeader(heroColor?: string | null): {
  className: string;
  style?: CSSProperties;
} {
  const raw = (heroColor ?? "").trim();
  if (!raw) return { className: FALLBACK_CLASS };

  if (raw.startsWith("#")) {
    const [a, b] = raw.split(",").map((s) => s.trim());
    const start = parseHex(a) ? a : null;
    if (!start) return { className: FALLBACK_CLASS };
    const end = b && parseHex(b) ? b : shade(start, 0.58);
    return {
      className: "",
      style: { backgroundImage: `linear-gradient(135deg, ${start}, ${end})` },
    };
  }

  return { className: `bg-gradient-to-br ${raw}` };
}
