// Night-by-night "where you sleep" timeline. Used compact on the event info
// tab and in full on the Accommodation tab.
import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, MapPin, Navigation, Tent } from "lucide-react";
import { fetchVenues, type RoomingRow, type Venue } from "@/lib/rooming";
import {
  buildNights,
  fetchMyHotelChoice,
  fetchMyRoomingRows,
  isTonight,
  nightDateLabel,
  sameHotel,
  type HotelChoice,
  type NightStay,
} from "@/lib/accommodation";
import { buildMapLink } from "@/lib/map-embed";
import { VillageFocusContext } from "@/lib/village-focus";
import type { EventDay, ScheduleItem } from "@/lib/mock-data";

/** Where the rider actually sleeps on a night, once their hotel answer is applied. */
export type NightHotel = { hotel: string; note: string | null; villageVenue: string | null };

type Props = {
  eventId: string;
  days: EventDay[] | null | undefined;
  schedule: ScheduleItem[] | null | undefined;
  /** compact = the card on the event info tab; full = the Accommodation tab */
  variant?: "compact" | "full";
  enabled?: boolean;
  finishLocation?: string | null;
};

export function useMyNights(eventId: string, days: Props["days"], schedule: Props["schedule"], enabled = true) {
  const venuesQ = useQuery({
    queryKey: ["event-venues", eventId],
    queryFn: () => fetchVenues(eventId),
    staleTime: 5 * 60_000,
    enabled,
  });
  const roomingQ = useQuery({
    queryKey: ["my-rooming-rows", eventId],
    queryFn: () => fetchMyRoomingRows(eventId),
    staleTime: 30_000,
    enabled,
  });
  const venues: Venue[] = venuesQ.data ?? [];
  const rows: RoomingRow[] = roomingQ.data ?? [];
  const nights = useMemo(
    () => buildNights({ days, schedule, venues, myRows: rows }),
    [days, schedule, venues, rows],
  );
  const multiVenue = venues.length > 1;
  return {
    nights,
    venues,
    rows,
    multiVenue,
    loading: venuesQ.isLoading || roomingQ.isLoading,
  };
}

/**
 * Which nights the "which hotel would you like?" question covers, and what the
 * rider ends up with on those nights. The question numbers nights from the
 * first night of racing, so any leading self-booked (pre-event) nights are
 * added back on.
 */
function hotelNightMap(nights: NightStay[], choice: HotelChoice | null): Map<number, NightHotel> {
  const map = new Map<number, NightHotel>();
  if (!choice) return map;
  let offset = 0;
  for (const n of nights) {
    if (n.venue?.self_booked) offset += 1;
    else break;
  }
  let scoped = choice.questionNights.map((n) => n + offset).filter((i) => nights.some((n) => n.index === i));
  if (scoped.length === 0) {
    // Fall back to the longest stay — the race village nights.
    const counts = new Map<string, number>();
    for (const n of nights) if (n.venue && !n.venue.self_booked) counts.set(n.venue.id, (counts.get(n.venue.id) ?? 0) + 1);
    let best: string | null = null;
    for (const [id, c] of counts) if (!best || c > (counts.get(best) ?? 0)) best = id;
    scoped = nights.filter((n) => n.venue?.id === best).map((n) => n.index);
  }
  for (const i of scoped) {
    const night = nights.find((n) => n.index === i);
    if (!night) continue;
    const village = night.venue?.name ?? null;
    if (sameHotel(choice.hotel, village)) continue; // staying at the race village itself
    map.set(i, { hotel: choice.hotel, note: choice.note, villageVenue: village });
  }
  return map;
}

export function AccommodationTimeline({ eventId, days, schedule, variant = "compact", enabled = true }: Props) {
  const { nights, multiVenue, loading } = useMyNights(eventId, days, schedule, enabled);
  const choiceQ = useQuery({
    queryKey: ["my-hotel-choice", eventId],
    queryFn: () => fetchMyHotelChoice(eventId),
    staleTime: 5 * 60_000,
    enabled,
  });
  const hotels = useMemo(() => hotelNightMap(nights, choiceQ.data ?? null), [nights, choiceQ.data]);

  if (!enabled) return null;
  if (loading) return <div className="h-24 animate-pulse rounded-2xl bg-secondary" />;
  if (nights.length === 0 || !multiVenue) return null;

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
        <BedDouble className="h-3.5 w-3.5" /> Where you sleep
      </p>
      <p className="mt-0.5 font-display text-base font-bold text-ink">
        This event moves — a different venue each night
      </p>
      <ol className="mt-3 space-y-2">
        {nights.map((n) => (
          <NightRow key={n.index} night={n} variant={variant} hotel={hotels.get(n.index) ?? null} />
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-ink-soft">
        The last day is a finish day — there's no accommodation on the final night.
      </p>

    </section>
  );
}

function NightRow({
  night,
  variant,
  hotel,
}: {
  night: NightStay;
  variant: "compact" | "full";
  hotel?: NightHotel | null;
}) {
  const focusVillage = useContext(VillageFocusContext);
  const a = night.allocation;
  const v = night.venue;
  const tonight = isTonight(night.date);
  const stayName = hotel?.hotel ?? v?.name ?? null;
  const mapLink = buildMapLink({ address: hotel ? hotel.hotel : (v?.address ?? v?.name ?? null) });
  const canFocus = Boolean(a?.village_tent_id || a?.village_zone_id || a?.village_spot_id || v?.village_spot_id);

  return (
    <li
      className={`rounded-xl p-3 ring-1 ${
        tonight ? "bg-accent ring-cherry/40" : "bg-secondary/60 ring-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
            Night {night.index}
            {night.date ? ` · ${nightDateLabel(night.date)}` : ""}
            {tonight ? <span className="ml-1.5 text-cherry">Tonight</span> : null}
          </p>
          <p className="mt-0.5 truncate font-display text-sm font-bold text-ink">
            {stayName ?? "Venue to be confirmed"}
          </p>
          {hotel ? (
            <p className="text-[11px] font-semibold text-cherry">
              You chose this hotel{hotel.note ? ` — ${hotel.note}` : ""}
              {hotel.villageVenue ? (
                <span className="font-normal text-ink-soft">
                  {" "}
                  · race village stays at {hotel.villageVenue}
                </span>
              ) : null}
            </p>
          ) : null}
          {v?.self_booked ? (
            <p className="text-[11px] font-semibold text-cherry">
              Booked separately — this night isn't part of your entry
            </p>
          ) : a ? (
            <p className="text-[11px] font-semibold text-ink">
              {a.tent_number ? `Tent / room ${a.tent_number}` : "Allocated"}
              {a.room_type ? <span className="font-normal text-ink-soft"> · {a.room_type}</span> : null}
            </p>
          ) : (
            <p className="text-[11px] text-ink-soft">
              Rooming list not loaded yet — allocations are published within 5 days of the event.
            </p>
          )}

          {variant === "full" ? (
            <div className="mt-1 space-y-0.5 text-[11px] text-ink-soft">
              {hotel ? (
                <p>
                  The race village stays at {hotel.villageVenue ?? "the main venue"} — it can't sleep
                  everyone, so overflow riders are booked at nearby hotels. Yours is {hotel.hotel}
                  {hotel.note ? ` (${hotel.note})` : ""}.
                </p>
              ) : null}
              {!hotel && v?.address ? <p>{v.address}</p> : null}
              {!hotel && v?.check_in ? <p>Check-in: {v.check_in}</p> : null}
              {!hotel && v?.check_out ? <p>Check-out: {v.check_out}</p> : null}
              {v?.notes ? <p>{v.notes}</p> : null}
              {a?.location_hint ? <p>Where to find it: {a.location_hint}</p> : null}
              {a?.notes ? <p>{a.notes}</p> : null}
            </div>
          ) : null}
        </div>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
            tonight ? "bg-cherry text-white" : "bg-cherry/10 text-cherry"
          }`}
        >
          <Tent className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {canFocus ? (
          <button
            type="button"
            onClick={() =>
              focusVillage({
                zoneId: a?.village_zone_id ?? null,
                spotId: a?.village_spot_id ?? v?.village_spot_id ?? null,
                tentId: a?.village_tent_id ?? null,
                venueId: v?.id ?? null,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-2.5 py-1.5 text-[11px] font-bold text-white"
          >
            <MapPin className="h-3.5 w-3.5" /> Village map
          </button>
        ) : null}
        {mapLink ? (
          <a
            href={mapLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-ink-soft"
          >
            <Navigation className="h-3.5 w-3.5" /> Directions
          </a>
        ) : null}
      </div>
    </li>
  );
}
