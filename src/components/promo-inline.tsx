import { useEffect, useMemo, useState } from "react";
import { Copy, Check, ExternalLink, Sparkles, Tag } from "lucide-react";

import type { EventPromo } from "@/lib/event-promos";

/**
 * Inline rider-offer strip built for the route sections.
 *
 * The route profiles are the most-viewed part of an event page, so offers are
 * dropped *between* the route cards rather than parked in a separate block.
 * Each strip is deliberately loud: brand gradient, sweeping shine, a rotating
 * message line and a one-tap "copy the code and go" action.
 */
export function PromoInline({ promo }: { promo: EventPromo }) {
  const [copied, setCopied] = useState(false);
  const hasLink = Boolean(promo.url && promo.url !== "#");

  // Rotating hooks keep the message alive as riders scroll the routes.
  const lines = useMemo(() => {
    const out = [promo.title];
    if (promo.blurb) out.push(promo.blurb);
    out.push(
      promo.code
        ? `Use code ${promo.code} — riders only`
        : `${promo.discount} for Red Cherry riders`,
    );

    return out;
  }, [promo]);

  const [line, setLine] = useState(0);
  useEffect(() => {
    setLine(0);
    if (lines.length < 2) return;
    const t = setInterval(() => setLine((v) => (v + 1) % lines.length), 4200);
    return () => clearInterval(t);
  }, [lines]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function copy() {
    if (!promo.code) return;
    try {
      navigator.clipboard?.writeText(promo.code);
    } catch {
      /* clipboard blocked — the code stays visible on screen */
    }
    setCopied(true);
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-[1.5px] shadow-sm"
      style={{ background: `linear-gradient(135deg, ${promo.accent}, oklch(0.22 0.02 260))` }}
    >
      <div
        className="relative overflow-hidden rounded-[14px] px-4 py-4 text-white"
        style={{ background: `linear-gradient(135deg, ${promo.accent}, oklch(0.2 0.02 260))` }}
      >
        {/* Sweeping highlight — draws the eye between two route profiles. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-promo-shine bg-white/30 blur-md"
        />

        <div className="relative flex items-start gap-3">
          {promo.logoUrl ? (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white p-1 ring-1 ring-white/50">
              <img
                src={promo.logoUrl}
                alt={`${promo.brand} logo`}
                loading="lazy"
                className="max-h-10 max-w-10 object-contain"
              />
            </span>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest opacity-90">
              <Sparkles className="h-3 w-3" /> Rider offer · {promo.brand}
            </p>
            {/* key forces the fade-in each time the message rotates */}
            <p
              key={line}
              className="mt-1 animate-promo-line-in font-display text-base font-bold leading-snug"
            >
              {lines[line]}
            </p>
          </div>

          <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-black uppercase tracking-wide text-ink">
            {promo.discount}
          </span>
        </div>

        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          {promo.code ? (
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-white/35 backdrop-blur active:scale-[0.98]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="font-mono tracking-wide">{promo.code}</span>
              <span className="opacity-80">{copied ? "copied" : "tap to copy"}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold ring-1 ring-white/35">
              <Tag className="h-3.5 w-3.5" /> {promo.redeem}
            </span>
          )}

          {hasLink ? (
            <a
              href={promo.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-ink active:scale-[0.98]"
            >
              Claim <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
