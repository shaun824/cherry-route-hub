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

  const mapped: EventPromo[] = storePromos.map((p) => ({
    id: p.id,
    brand: p.brand,
    title: p.title,
    blurb: p.expires
      ? `Expires ${new Date(p.expires).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
      : undefined,
    code: p.code || undefined,
    redeem: p.code ? undefined : "Show this offer to the supplier",
    discount: p.discount,
    url: p.url || "#",
    logoUrl: p.logoUrl ?? "",
    accent: p.accent,
  }));

  const promos = useShuffledPromos(mapped);

  return (
    <div>
      <PageHeader title="Supplier Promos" subtitle="Perks from our sponsors" />
      <div className="px-5 py-5">
        <PromoCarousel promos={promos} />
      </div>
      <ul className="space-y-3 px-5 pb-5">
        {promos.slice(1).map((promo) => (
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
