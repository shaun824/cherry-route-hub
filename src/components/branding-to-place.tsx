// Village build: branding booked in by crew that still needs a spot on the map.
// One tap drops a branding pin, which links the booking to that map point.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Boxes } from "lucide-react";
import {
  brandingKindLabel,
  fetchBrandingBookings,
  updateBooking,
  type BrandingBooking,
} from "@/lib/branding-inventory";

export function BrandingToPlace({
  eventId,
  onPlace,
}: {
  eventId: string;
  /** Drops a pin for this booking and returns the new map point id. */
  onPlace: (booking: BrandingBooking) => string | null;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["branding-bookings", eventId],
    queryFn: () => fetchBrandingBookings(eventId),
    enabled: !!eventId,
  });
  const bookings = q.data ?? [];
  const todo = bookings.filter((b) => !b.village_spot_id);

  if (!bookings.length) return null;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
      <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
        <Boxes className="h-4 w-4 text-cherry" /> Branding booked in
      </h2>
      <p className="mt-0.5 text-[11px] text-ink-soft">
        Booked by crew under Inventory management. Drop each one onto the map so the build team knows
        where it goes.
      </p>
      <ul className="mt-3 space-y-2">
        {bookings.map((b) => (
          <li
            key={b.id}
            className="flex items-start justify-between gap-3 rounded-xl bg-surface p-2.5 ring-1 ring-border"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {b.qty} × {b.name}
              </p>
              <p className="text-[11px] text-ink-soft">
                {brandingKindLabel(b.kind)}
                {b.size_spec ? ` · ${b.size_spec}` : ""}
                {b.placement ? ` · ${b.placement}` : ""}
              </p>
            </div>
            {b.village_spot_id ? (
              <span className="shrink-0 rounded-full bg-cherry/10 px-2 py-1 text-[10px] font-bold text-cherry">
                On the map
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const spotId = onPlace(b);
                  if (!spotId) return;
                  void updateBooking(b.id, { village_spot_id: spotId, status: "placed" }).then(() =>
                    qc.invalidateQueries({ queryKey: ["branding-bookings", eventId] }),
                  );
                }}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-cherry px-2.5 py-1.5 text-[11px] font-bold text-white"
              >
                <MapPin className="h-3 w-3" /> Drop pin
              </button>
            )}
          </li>
        ))}
      </ul>
      {todo.length ? (
        <p className="mt-2 text-[11px] text-ink-soft">
          {todo.length} still to place. Save the map when you're done.
        </p>
      ) : null}
    </section>
  );
}
