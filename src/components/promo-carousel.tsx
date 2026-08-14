import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { EventPromo } from "@/lib/event-promos";
import { PromoCodeCard } from "@/components/promo-code-card";

/** Rotates through rider offers, with a visible list of every brand on offer. */
export function PromoCarousel({ promos }: { promos: EventPromo[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || promos.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % promos.length), 7000);
    return () => clearInterval(t);
  }, [paused, promos.length]);

  const idx = Math.min(i, promos.length - 1);
  const promo = promos[idx];
  if (!promo) return null;

  const go = (next: number) => {
    setPaused(true);
    setI((next + promos.length) % promos.length);
  };

  return (
    <div onPointerDown={() => setPaused(true)}>
      {promos.length > 1 ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {promos.length} offers to use — tap one
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous offer"
                onClick={() => go(idx - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">
                {idx + 1}/{promos.length}
              </span>
              <button
                type="button"
                aria-label="Next offer"
                onClick={() => go(idx + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {promos.map((p, n) => {
              const active = n === idx;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-current={active}
                  onClick={() => go(n)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-transparent bg-ink text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <img
                    src={p.logoUrl}
                    alt=""
                    className="h-4 w-8 rounded-sm bg-white object-contain p-px"
                    loading="lazy"
                  />
                  <span className="max-w-28 truncate">{p.brand}</span>
                  <span className={active ? "opacity-80" : "text-ink"}>{p.discount}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <PromoCodeCard key={promo.id} promo={promo} />

      {promos.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {promos.map((p, n) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Show ${p.brand} offer`}
              aria-current={n === idx}
              onClick={() => go(n)}
              className={
                n === idx
                  ? "h-2 w-6 rounded-full bg-ink transition-all"
                  : "h-2 w-2 rounded-full bg-border transition-all"
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
