import { useEffect, useState } from "react";

import type { EventPromo } from "@/lib/event-promos";
import { PromoCodeCard } from "@/components/promo-code-card";

/** Rotates through rider offers, with dots to jump between them. */
export function PromoCarousel({ promos }: { promos: EventPromo[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || promos.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % promos.length), 7000);
    return () => clearInterval(t);
  }, [paused, promos.length]);

  const promo = promos[Math.min(i, promos.length - 1)];
  if (!promo) return null;

  return (
    <div onPointerDown={() => setPaused(true)}>
      <PromoCodeCard key={promo.id} promo={promo} />
      {promos.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {promos.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Show ${p.brand} offer`}
              aria-current={idx === i}
              onClick={() => {
                setPaused(true);
                setI(idx);
              }}
              className={
                idx === i
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
