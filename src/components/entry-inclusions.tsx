// "What you get at the event" — turns the rider's Entry Ninja extras into a
// slick, icon-led list with a plain-English description and collection
// instructions. Descriptions scraped from the event website (kept fresh by the
// weekly merch sync) override the built-in fallbacks.
import { useQuery } from "@tanstack/react-query";
import {
  Backpack,
  Beer,
  BedDouble,
  Bike,
  Camera,
  CircleHelp,
  Droplets,
  ExternalLink,
  HeartPulse,
  IdCard,
  Package,
  Shirt,
  Tent,
  Ticket,
  Truck,
  UtensilsCrossed,
  Salad,
  Bus,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { groupExtras, type DisplayExtra } from "@/lib/extras-display";
import type { ExtraItem } from "@/lib/my-events";
import { inclusionMeta, merchKey, merchKeysMatch, type InclusionIcon } from "@/lib/inclusion-meta";

const ICONS: Record<InclusionIcon, LucideIcon> = {
  shirt: Shirt,
  jacket: Shirt,
  bike: Bike,
  wash: Droplets,
  wrench: Wrench,
  licence: IdCard,
  meal: UtensilsCrossed,
  diet: Salad,
  transfer: Truck,
  shuttle: Bus,
  bed: BedDouble,
  tent: Tent,
  ticket: Ticket,
  massage: HeartPulse,
  photo: Camera,
  bag: Backpack,
  beer: Beer,
  package: Package,
};

type CatalogRow = {
  name: string;
  description: string | null;
  image_url: string | null;
  price_from: number | null;
  source_url: string | null;
};

export function useEventMerchInfo(eventId: string) {
  return useQuery({
    queryKey: ["event-merch-info", eventId],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<CatalogRow[]> => {
      const { data, error } = await supabase
        .from("event_merch_options")
        .select("name, description, image_url, price_from, source_url")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
  });
}

function findCatalog(catalog: CatalogRow[] | undefined, name: string) {
  if (!catalog?.length) return null;
  const key = merchKey(name);
  return catalog.find((c) => merchKeysMatch(key, merchKey(c.name))) ?? null;
}

const ZAR = (n: number) =>
  `R${Math.round(n).toLocaleString("en-ZA")}`;

function InclusionRow({
  item,
  catalog,
}: {
  item: DisplayExtra & { sizeLabel?: string | null };
  catalog: CatalogRow[] | undefined;
}) {
  const meta = inclusionMeta(item.name);
  const Icon = ICONS[meta.icon] ?? Package;
  const match = findCatalog(catalog, item.name);
  const blurb = match?.description?.trim() || meta.blurb;

  return (
    <li className="flex gap-3 px-3 py-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-cherry-deep">
        <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-display text-[13px] font-bold leading-tight text-ink">{item.name}</p>
          {item.option ? (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
              {item.option}
            </span>
          ) : null}
          {item.qty > 1 ? (
            <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">
              ×{item.qty}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] leading-snug text-ink">{blurb}</p>
        <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-ink-soft">
          <CircleHelp className="mt-[1px] h-3 w-3 shrink-0" />
          <span>{meta.howTo}</span>
        </p>
        {match?.price_from ? (
          <p className="mt-1 text-[11px] font-semibold text-ink-soft">
            From {ZAR(match.price_from)}
          </p>
        ) : null}
        {match?.source_url ? (
          <a
            href={match.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-cherry"
          >
            More on the website <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

export function EntryInclusions({
  eventId,
  extras,
  sizes,
}: {
  eventId: string;
  extras: ExtraItem[] | null | undefined;
  /** Apparel sizes already known from the entry (jacket / t-shirt). */
  sizes?: { label: string; value: string }[];
}) {
  const catalogQ = useEventMerchInfo(eventId);
  const groups = groupExtras(extras);

  const sizeItems: DisplayExtra[] = (sizes ?? [])
    .filter((s) => s.value)
    .map((s) => ({ name: s.label, option: s.value, qty: 1 }));

  if (!groups.length && !sizeItems.length) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-border">
      <div className="bg-ink px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
          What you get at the event
        </p>
        <p className="font-display text-sm font-bold text-white">
          Your inclusions, and how to claim each one
        </p>
      </div>

      {sizeItems.length ? (
        <ul className="divide-y divide-border bg-card">
          {sizeItems.map((s) => (
            <InclusionRow key={s.name} item={s} catalog={catalogQ.data} />
          ))}
        </ul>
      ) : null}

      {groups.map((g) => (
        <div key={g.key}>
          <p className="bg-secondary/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
            {g.label}
          </p>
          <ul className="divide-y divide-border bg-card">
            {g.items.map((item, i) => (
              <InclusionRow key={`${g.key}-${i}`} item={item} catalog={catalogQ.data} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
