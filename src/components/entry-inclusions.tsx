// "What you get at the event" — turns the rider's Entry Ninja extras into a
// slick, icon-led list with a plain-English description and collection
// instructions. Descriptions scraped from the event website (kept fresh by the
// weekly merch sync) override the built-in fallbacks.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Backpack,
  Beer,
  BedDouble,
  Bike,
  Camera,
  CircleHelp,
  Info,
  Droplets,
  ExternalLink,
  HeartPulse,
  IdCard,
  Package,
  Shirt,
  ShoppingBag,
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
import { InclusionInfoDialog } from "@/components/inclusion-info-dialog";
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
  eventId,
}: {
  item: DisplayExtra & { sizeLabel?: string | null };
  catalog: CatalogRow[] | undefined;
  eventId: string;
}) {
  const [open, setOpen] = useState(false);
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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-bold text-ink ring-1 ring-border"
          >
            <Info className="h-3.5 w-3.5" /> More info
          </button>
          {match?.source_url ? (
            <a
              href={match.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-cherry"
            >
              On the website <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
        <InclusionInfoDialog
          open={open}
          onOpenChange={setOpen}
          eventId={eventId}
          name={item.name}
          option={item.option}
          qty={item.qty}
          websiteDescription={match?.description ?? null}
          priceFrom={match?.price_from ?? null}
          sourceUrl={match?.source_url ?? null}
        />
      </div>
    </li>
  );
}

/** Catalogue items the rider hasn't bought yet — one tap to their Entry Ninja profile. */
function AddMoreMerch({
  catalog,
  owned,
  addUrl,
}: {
  catalog: CatalogRow[] | undefined;
  owned: DisplayExtra[];
  addUrl: string;
}) {
  const ownedKeys = owned.map((o) => merchKey(o.name));
  const available = (catalog ?? []).filter(
    (c) => c.name && !ownedKeys.some((k) => merchKeysMatch(k, merchKey(c.name))),
  );

  return (
    <div className="border-t border-border bg-secondary/50 px-3 py-3">
      <p className="font-display text-[13px] font-bold text-ink">Want to add more?</p>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
        Merchandise and extras are added on your Entry Ninja registration — the link below opens
        your entry so you can add them, and it syncs straight back here.
      </p>

      {available.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {available.slice(0, 8).map((c) => (
            <li
              key={c.name}
              className="rounded-full bg-card px-2 py-1 text-[11px] font-semibold text-ink ring-1 ring-border"
            >
              {c.name}
              {c.price_from ? (
                <span className="text-ink-soft"> · from {ZAR(c.price_from)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <a
        href={addUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cherry px-3 py-2.5 text-xs font-bold text-white"
      >
        <ShoppingBag className="h-3.5 w-3.5" /> Add merchandise on Entry Ninja
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

export function EntryInclusions({
  eventId,
  extras,
  sizes,
  addUrl,
}: {
  eventId: string;
  extras: ExtraItem[] | null | undefined;
  /** Apparel sizes already known from the entry (jacket / t-shirt). */
  sizes?: { label: string; value: string }[];
  /** Direct link to the rider's Entry Ninja registration, where extras are added. */
  addUrl?: string | null;
}) {
  const catalogQ = useEventMerchInfo(eventId);
  const groups = groupExtras(extras);

  const sizeItems: DisplayExtra[] = (sizes ?? [])
    .filter((s) => s.value)
    .map((s) => ({ name: s.label, option: s.value, qty: 1 }));

  if (!groups.length && !sizeItems.length && !addUrl) return null;

  const owned: DisplayExtra[] = [...sizeItems, ...groups.flatMap((g) => g.items)];

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
            <InclusionRow key={s.name} item={s} catalog={catalogQ.data} eventId={eventId} />
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
              <InclusionRow key={`${g.key}-${i}`} item={item} catalog={catalogQ.data} eventId={eventId} />
            ))}
          </ul>
        </div>
      ))}

      {addUrl ? (
        <AddMoreMerch catalog={catalogQ.data} owned={owned} addUrl={addUrl} />
      ) : null}
    </div>
  );
}

