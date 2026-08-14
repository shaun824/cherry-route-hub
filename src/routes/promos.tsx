import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-bits";
import { SponsorScroller } from "@/components/sponsor-scroller";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { PromoCodeCard } from "@/components/promo-code-card";
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
  const promos = useAdminStore((s) => s.promos);

  return (
    <div>
      <PageHeader title="Supplier Promos" subtitle="Perks from our sponsors" />
      <ul className="space-y-3 px-5 py-5">
        {promos.map((p) => {
          const promo: EventPromo = {
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
          };
          return (
            <li key={p.id}>
              <PromoCodeCard promo={promo} />
            </li>
          );
        })}
      </ul>
      <SponsorScroller title="Our sponsors" />
      <div className="pb-6" />
    </div>
  );
}
