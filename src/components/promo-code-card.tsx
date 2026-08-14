import { useEffect, useRef, useState } from "react";
import { Copy, Check, ExternalLink, X } from "lucide-react";

import type { EventPromo } from "@/lib/event-promos";

/**
 * Promo module with the same behaviour as the Supplier Promos page:
 * tapping the offer copies the code, shows a "use this code" pop-up,
 * then opens the partner site. Offers without a code show redeem info.
 */
export function PromoCodeCard({ promo }: { promo: EventPromo }) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pending) return;
    timer.current = setTimeout(() => {
      window.open(promo.url, "_blank", "noopener,noreferrer");
      setPending(false);
    }, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pending, promo.url]);

  function copy() {
    if (!promo.code) return;
    navigator.clipboard?.writeText(promo.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <div
          className="px-4 py-4 text-white"
          style={{ background: `linear-gradient(135deg, ${promo.accent}, oklch(0.2 0.02 260))` }}
        >
          <div className="flex items-start gap-3">
            {promo.logoUrl ? (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/95 p-1 ring-1 ring-white/40">
                <img
                  src={promo.logoUrl}
                  alt={`${promo.brand} logo`}
                  loading="lazy"
                  className="max-h-10 max-w-10 object-contain"
                />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
                {promo.brand}
              </p>
              <p className="mt-1 font-display text-lg font-bold leading-tight">{promo.title}</p>
              {promo.blurb ? <p className="mt-2 text-xs opacity-85">{promo.blurb}</p> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {promo.code ? "Discount code" : "How to redeem"}
            </p>
            {promo.code ? (
              <p className="mt-0.5 truncate font-mono text-base font-bold text-ink">{promo.code}</p>
            ) : (
              <p className="mt-0.5 text-xs font-semibold text-ink">{promo.redeem}</p>
            )}
          </div>
          {promo.code ? (
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          ) : null}
          <a
            href={promo.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!promo.code) return;
              e.preventDefault();
              copy();
              setPending(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-black uppercase text-cherry-deep hover:underline"
          >
            {promo.discount} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {pending && promo.code ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-6">
          <div className="relative w-full max-w-sm rounded-2xl bg-card p-6 text-center ring-1 ring-border">
            <button
              type="button"
              onClick={() => setPending(false)}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-sm text-muted-foreground">
              Use this code on {promo.brand}&apos;s website
            </p>
            <p className="mt-3 font-mono text-2xl font-black text-ink">{promo.code}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Code copied — taking you there in a moment…
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
