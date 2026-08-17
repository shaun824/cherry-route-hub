import { useEffect, useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

import type { EventPromo } from "@/lib/event-promos";
import { PromoReminderDialog } from "@/components/promo-reminder-dialog";


/**
 * Promo module. Tapping anywhere on the offer opens a reminder pop-up showing
 * the discount code (auto-copied), and the rider taps "Continue" to open the
 * partner site — the link is a real user gesture so pop-up blockers never eat it.
 * Offers without a code show the redeem instructions instead.
 */
export function PromoCodeCard({ promo }: { promo: EventPromo }) {
  const [copied, setCopied] = useState(false);
  const hasLink = Boolean(promo.url && promo.url !== "#");
  const [open, setOpen] = useState(false);

  function copy() {
    if (!promo.code) return;
    try {
      navigator.clipboard?.writeText(promo.code);
    } catch {
      /* clipboard blocked — the code is still shown on screen */
    }
    setCopied(true);
  }

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  // Opening the reminder always copies, so the code is ready to paste.
  function openReminder() {
    copy();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <button
          type="button"
          onClick={openReminder}
          className="block w-full px-4 py-4 text-left text-white"
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
        </button>

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
          <button
            type="button"
            onClick={openReminder}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-black uppercase text-cherry-deep"
          >
            {promo.discount} <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      <PromoReminderDialog promo={promo} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
