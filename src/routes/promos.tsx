import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-bits";
import { SponsorScroller } from "@/components/sponsor-scroller";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { PromoCodeCard } from "@/components/promo-code-card";
import { PromoCarousel } from "@/components/promo-carousel";
import { useShuffledPromos } from "@/lib/use-shuffled-promos";
import type { EventPromo } from "@/lib/event-promos";


export const Route = createFileRoute("/promos")({
  head: () => ({
    meta: [
      { title: "Supplier Promos — Red Cherry Events" },
      { name: "description", content: "Discount codes and offers from Red Cherry sponsors and suppliers." },
    ],
  }),
  component: Promos,
});

function Promos() {
  useHydratedStore();
  const storePromos = useAdminStore((s) => s.promos);

  const mapped: EventPromo[] = storePromos.filter(isPromoLive).map(toEventPromo);

  const promos = useShuffledPromos(mapped);

  return (
    <div>
      <PageHeader title="Supplier Promos" subtitle="Perks from our sponsors" />
      <div className="px-5 py-5">
        <PromoCarousel promos={promos} />
      </div>
      <p className="px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        All offers
      </p>
      <ul className="space-y-3 px-5 pb-5">

        {promos.map((promo: EventPromo) => (
          <li key={promo.id}>
            <PromoCodeCard promo={promo} />
          </li>
        ))}
      </ul>

      <SponsorScroller title="Our sponsors" />
      <div className="pb-6" />
    </div>
  );
}
