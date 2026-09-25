import { useState } from "react";
import { ExternalLink, Sparkles, Tag } from "lucide-react";

import type { EventPromo } from "@/lib/event-promos";
import { PromoReminderDialog } from "@/components/promo-reminder-dialog";
import { trackPromoAction, usePromoImpression } from "@/lib/promo-analytics";

/**
 * Inline rider-offer strip built for the route sections.
 *
 * The wording is static — riders read the offer once, no rotating lines — and
 * tapping the strip opens the same approved reminder pop-up used everywhere
 * else, which restates the offer and copies the code before sending them on.
 */
export function PromoInline({ promo }: { promo: EventPromo }) {
  const [open, setOpen] = useState(false);
  usePromoImpression(promo);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          trackPromoAction(promo, "promo_open");
          setOpen(true);
        }}
        className="relative block w-full overflow-hidden rounded-2xl p-[1.5px] text-left shadow-sm active:scale-[0.995]"
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
              <p className="mt-1 font-display text-base font-bold leading-snug">{promo.title}</p>
              {promo.blurb ? <p className="mt-1.5 text-xs opacity-90">{promo.blurb}</p> : null}
            </div>

            <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-black uppercase tracking-wide text-ink">
              {promo.discount}
            </span>
          </div>

          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold ring-1 ring-white/35">
              <Tag className="h-3.5 w-3.5" />
              {promo.code ? `Code ${promo.code}` : promo.redeem}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-ink">
              {promo.code ? "Get the code" : "View offer"} <ExternalLink className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </button>

      <PromoReminderDialog promo={promo} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
