// "More info" pop-up for one entry inclusion / merchandise item: the full
// description from the event website, exactly what's included, when you can
// access it, where it sits in the village and how to walk to it.
import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MapPin, Clock, Info, CheckCircle2, Navigation } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchVillageMaps, categoryMeta } from "@/lib/village-map";
import type { VillageHotspot } from "@/lib/village-map";
import { inclusionDetail, matchingSpots, matchingSchedule } from "@/lib/inclusion-detail";
import { inclusionMeta } from "@/lib/inclusion-meta";
import { withRegistrationDayLabels } from "@/lib/event-days";
import type { EventDay, ScheduleItem } from "@/lib/mock-data";
import { VillageFocusContext } from "@/lib/village-focus";

type EventShape = {
  schedule: ScheduleItem[];
  days: EventDay[];
  venues: { id: string; name: string; address: string | null }[];
};

async function fetchEventContext(eventId: string): Promise<EventShape> {
  const [{ data: ev }, { data: venues }] = await Promise.all([
    supabase.from("events").select("schedule, days").eq("id", eventId).maybeSingle(),
    supabase
      .from("event_venues")
      .select("id, name, address, sort_order")
      .eq("event_id", eventId)
      .order("sort_order"),
  ]);
  const schedule = Array.isArray(ev?.schedule) ? (ev!.schedule as unknown as ScheduleItem[]) : [];
  const days = Array.isArray(ev?.days) ? (ev!.days as unknown as EventDay[]) : [];
  return {
    schedule,
    days: withRegistrationDayLabels(days, schedule),
    venues: (venues ?? []).map((v) => ({ id: v.id, name: v.name, address: v.address })),
  };
}

export function InclusionInfoDialog({
  open,
  onOpenChange,
  eventId,
  name,
  option,
  qty,
  websiteDescription,
  priceFrom,
  sourceUrl,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  name: string;
  option?: string | null;
  qty?: number;
  websiteDescription?: string | null;
  priceFrom?: number | null;
  sourceUrl?: string | null;
}) {
  const focusVillage = useContext(VillageFocusContext);
  const meta = inclusionMeta(name);
  const detail = inclusionDetail(name);

  const ctxQ = useQuery({
    queryKey: ["inclusion-context", eventId],
    queryFn: () => fetchEventContext(eventId),
    staleTime: 10 * 60_000,
    enabled: open,
  });
  const mapsQ = useQuery({
    queryKey: ["village-maps", eventId],
    queryFn: () => fetchVillageMaps(eventId),
    staleTime: 10 * 60_000,
    enabled: open,
  });

  const spots = useMemo(() => {
    const maps = mapsQ.data ?? [];
    const out: { spot: VillageHotspot; venueId: string | null }[] = [];
    for (const m of maps) {
      for (const s of matchingSpots(m.hotspots ?? [], detail, name)) {
        out.push({ spot: s, venueId: m.venue_id });
      }
    }
    return out.slice(0, 6);
  }, [mapsQ.data, detail, name]);

  const scheduleLines = useMemo(() => {
    const ctx = ctxQ.data;
    if (!ctx) return [] as { item: ScheduleItem; dayLabel: string | null }[];
    return matchingSchedule(ctx.schedule, detail).map((item) => ({
      item,
      dayLabel: ctx.days.find((d) => d.id === item.dayId)?.label ?? null,
    }));
  }, [ctxQ.data, detail]);

  const venueName = (id: string | null) =>
    id ? ctxQ.data?.venues.find((v) => v.id === id)?.name ?? null : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg leading-tight text-ink">{name}</DialogTitle>
          <DialogDescription className="text-[12px]">
            {[option, qty && qty > 1 ? `×${qty}` : null].filter(Boolean).join(" · ") ||
              "Part of your entry package"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-[12.5px] leading-snug text-ink">
          <p>{websiteDescription?.trim() || meta.blurb}</p>

          {detail.included.length ? (
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                <CheckCircle2 className="h-3.5 w-3.5" /> What's included
              </h3>
              <ul className="space-y-1">
                {detail.included.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-cherry" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl bg-secondary/70 p-3">
            <h3 className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
              <Info className="h-3.5 w-3.5" /> How you claim it
            </h3>
            <p>{meta.howTo}</p>
          </section>

          {scheduleLines.length ? (
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                <Clock className="h-3.5 w-3.5" /> When you can access it
              </h3>
              <ul className="space-y-1.5">
                {scheduleLines.map(({ item, dayLabel }, i) => (
                  <li key={`${item.label}-${i}`} className="flex gap-2">
                    <span className="w-14 shrink-0 font-bold text-cherry">{item.time}</span>
                    <span>
                      {dayLabel ? (
                        <span className="mr-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-cherry-deep">
                          {dayLabel}
                        </span>
                      ) : null}
                      <span className="font-semibold">{item.label}</span>
                      {item.details ? (
                        <span className="block text-[11.5px] text-ink-soft">{item.details}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
              <MapPin className="h-3.5 w-3.5" /> Where to find it
            </h3>
            <p className="text-ink-soft">{detail.wherePlain}</p>
            {spots.length ? (
              <ul className="mt-2 space-y-2">
                {spots.map(({ spot, venueId }) => (
                  <li key={`${venueId ?? "main"}-${spot.id}`} className="rounded-xl bg-card p-2.5 ring-1 ring-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-[13px] font-bold text-ink">{spot.title}</p>
                        <p className="text-[11px] text-ink-soft">
                          {[venueName(venueId), categoryMeta(spot.category)?.label].filter(Boolean).join(" · ")}
                        </p>
                        {spot.hours ? (
                          <p className="text-[11px] font-semibold text-ink">Open: {spot.hours}</p>
                        ) : null}
                        {spot.description ? (
                          <p className="mt-0.5 text-[11.5px] text-ink-soft">{spot.description}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          focusVillage({ spotId: spot.id, venueId });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-cherry px-2.5 py-1.5 text-[11px] font-bold text-white"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Show me on the village map
                      </button>
                      {Number.isFinite(spot.lat) && Number.isFinite(spot.lng) ? (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-bold text-white"
                        >
                          <Navigation className="h-3.5 w-3.5" /> Directions
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[11.5px] text-ink-soft">
                Open the Village tab for the full map — the info desk will point you there if it
                isn't pinned yet.
              </p>
            )}
          </section>

          {detail.goodToKnow.length ? (
            <section>
              <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Good to know
              </h3>
              <ul className="space-y-1">
                {detail.goodToKnow.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/30" />
                    <span className="text-ink-soft">{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {priceFrom ? (
            <p className="text-[11.5px] font-semibold text-ink-soft">
              Add another from R{Math.round(priceFrom).toLocaleString("en-ZA")} on Entry Ninja.
            </p>
          ) : null}

          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-cherry"
            >
              Read the full details on the event website <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
