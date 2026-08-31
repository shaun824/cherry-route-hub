// Crew inventory management: book branding kit into an event. Bookings feed the
// village build map (branding layer) and the branding team's packing list.
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Check, Loader2, MapPin, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin, useIsCrew } from "@/lib/auth";
import { useCrewEvent } from "@/lib/crew-event";
import { fetchCrewEvents } from "@/lib/crew";
import { fetchDepartments } from "@/lib/run-sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  BRANDING_KINDS,
  BRANDING_STATUSES,
  bookBranding,
  brandingKindLabel,
  deleteBooking,
  deleteBrandingItem,
  fetchBrandingBookings,
  fetchBrandingItems,
  packingLine,
  saveBrandingItem,
  totalsByKind,
  updateBooking,
  type BrandingItem,
} from "@/lib/branding-inventory";

export const Route = createFileRoute("/crew/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory management · Red Cherry Crew" },
      {
        name: "description",
        content:
          "Crew tool: book branding kit into an event, send it to the village build map and build the branding team's packing list.",
      },
      { property: "og:title", content: "Inventory management · Red Cherry Crew" },
      {
        property: "og:description",
        content: "Book branding into an event and see exactly what has to be packed and placed on site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { isCrew, loading, user } = useIsCrew();
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"booked" | "catalogue">("booked");

  const eventsQ = useQuery({ queryKey: ["crew-events"], queryFn: fetchCrewEvents, enabled: isCrew });
  const events = eventsQ.data ?? [];
  const [eventId, setEventId] = useCrewEvent(events);

  const itemsQ = useQuery({ queryKey: ["branding-items"], queryFn: fetchBrandingItems, enabled: isCrew });
  const bookingsQ = useQuery({
    queryKey: ["branding-bookings", eventId],
    queryFn: () => fetchBrandingBookings(eventId),
    enabled: isCrew && !!eventId,
  });
  const deptQ = useQuery({
    queryKey: ["crew-departments", eventId],
    queryFn: () => fetchDepartments(eventId),
    enabled: isCrew && !!eventId,
  });

  const items = itemsQ.data ?? [];
  const bookings = bookingsQ.data ?? [];
  const departments = deptQ.data ?? [];
  const totals = useMemo(() => totalsByKind(bookings), [bookings]);
  const unplaced = bookings.filter((b) => b.status === "booked");

  // Booking form
  const [pickId, setPickId] = useState("");
  const [qty, setQty] = useState(1);
  const [placement, setPlacement] = useState("");
  const [deptId, setDeptId] = useState("");

  const refreshBookings = () => qc.invalidateQueries({ queryKey: ["branding-bookings", eventId] });

  async function addBooking() {
    const item = items.find((i) => i.id === pickId);
    if (!item) return toast.error("Pick an item from the catalogue first.");
    try {
      await bookBranding({
        eventId,
        item,
        qty,
        placement: placement.trim() || null,
        departmentId: deptId || null,
      });
      setQty(1);
      setPlacement("");
      await refreshBookings();
      toast.success(`${item.name} booked in`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not book that in.");
    }
  }

  async function pushToPacking() {
    if (!isAdmin) return;
    if (!deptId) return toast.error("Choose the department that packs branding first.");
    const rows = bookings.map((b, i) => ({
      event_id: eventId,
      department_id: deptId,
      item: packingLine(b),
      qty: String(b.qty),
      notes: b.placement ?? null,
      source: "branding",
      sort_order: i,
    }));
    if (!rows.length) return toast.error("Nothing booked in yet.");
    const { error } = await supabase.from("department_packing_items").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} branding items added to the packing list`);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (!user) return <Navigate to="/crew/login" />;
  if (!isCrew) return <Navigate to="/crew/login" />;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cherry/10 text-cherry">
          <Boxes className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Crew tools</p>
          <h1 className="font-display text-2xl font-bold text-ink">Inventory management</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Book branding into the event. Everything booked here shows up on the village build map to be
            placed, and forms the branding team's packing list.
          </p>
        </div>
      </header>

      {events.length > 1 ? (
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-4 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-ink"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
        {(["booked", "catalogue"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full py-1.5 text-xs font-bold transition ${
              tab === t ? "bg-card text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {t === "booked" ? "Booked for this event" : "Branding catalogue"}
          </button>
        ))}
      </div>

      {tab === "booked" ? (
        <>
          <section className="mt-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <h2 className="font-display text-sm font-bold text-ink">Book branding in</h2>
            <div className="mt-3 space-y-2">
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              >
                <option value="">Choose an item…</option>
                {items
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {i.size_spec ? ` · ${i.size_spec}` : ""}
                      {i.qty_owned ? ` · ${i.qty_owned} in stock` : ""}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-20 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                  aria-label="Quantity"
                />
                <input
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  placeholder="Where does it go? e.g. finish gantry"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                />
              </div>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              >
                <option value="">No department yet</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void addBooking()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-cherry px-3 py-2.5 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Book into this event
              </button>
              {!items.length ? (
                <p className="text-xs text-ink-soft">
                  Nothing in the catalogue yet — add your branding kit on the catalogue tab.
                </p>
              ) : null}
            </div>
          </section>

          {totals.length ? (
            <section className="mt-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
              <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
                <Package className="h-4 w-4 text-cherry" /> On the truck
              </h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {totals.map((t) => (
                  <li
                    key={t.kind}
                    className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-ink-soft ring-1 ring-border"
                  >
                    {t.qty} × {t.label}
                  </li>
                ))}
              </ul>
              {unplaced.length ? (
                <p className="mt-2 text-[11px] text-ink-soft">
                  {unplaced.length} item{unplaced.length === 1 ? "" : "s"} still to be placed on the{" "}
                  <Link to="/crew/build" className="font-semibold text-cherry underline">
                    build map
                  </Link>
                  .
                </p>
              ) : null}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => void pushToPacking()}
                  className="mt-3 w-full rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"
                >
                  Add all of this to the selected department's packing list
                </button>
              ) : null}
            </section>
          ) : null}

          <ul className="mt-4 space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {b.qty} × {b.name}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {brandingKindLabel(b.kind)}
                      {b.size_spec ? ` · ${b.size_spec}` : ""}
                      {b.placement ? ` · ${b.placement}` : ""}
                    </p>
                    {b.village_spot_id ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-cherry">
                        <MapPin className="h-3 w-3" /> Placed on the village map
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void deleteBooking(b.id)
                        .then(refreshBookings)
                        .catch((e) => toast.error(String(e)))
                    }
                    className="shrink-0 rounded-lg bg-surface p-2 text-ink-soft ring-1 ring-border"
                    aria-label="Remove booking"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex gap-1">
                  {BRANDING_STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.blurb}
                      onClick={() =>
                        void updateBooking(b.id, { status: s.id })
                          .then(refreshBookings)
                          .catch((e) => toast.error(String(e)))
                      }
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                        b.status === s.id ? "bg-cherry text-white" : "bg-surface text-ink-soft ring-1 ring-border"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {!bookings.length && !bookingsQ.isLoading ? (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
                Nothing booked into this event yet.
              </li>
            ) : null}
          </ul>
        </>
      ) : (
        <CatalogueTab items={items} onChanged={() => qc.invalidateQueries({ queryKey: ["branding-items"] })} />
      )}
    </div>
  );
}

function CatalogueTab({ items, onChanged }: { items: BrandingItem[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("flag");
  const [size, setSize] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [owned, setOwned] = useState(0);

  async function add() {
    if (!name.trim()) return toast.error("Give the item a name.");
    try {
      await saveBrandingItem({
        name,
        kind,
        size_spec: size.trim() || null,
        sponsor: sponsor.trim() || null,
        qty_owned: owned,
      });
      setName("");
      setSize("");
      setSponsor("");
      setOwned(0);
      onChanged();
      toast.success("Added to the catalogue");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that item.");
    }
  }

  return (
    <>
      <section className="mt-4 space-y-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <h2 className="font-display text-sm font-bold text-ink">Add branding kit</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name, e.g. Red Cherry feather flag"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            {BRANDING_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={owned}
            onChange={(e) => setOwned(Number(e.target.value))}
            className="w-24 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            aria-label="Quantity owned"
            placeholder="Owned"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Size, e.g. 3m × 1m"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
          <input
            value={sponsor}
            onChange={(e) => setSponsor(e.target.value)}
            placeholder="Sponsor"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void add()}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-cherry px-3 py-2.5 text-sm font-bold text-white"
        >
          <Check className="h-4 w-4" /> Add to catalogue
        </button>
      </section>

      <ul className="mt-4 space-y-2">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex items-start justify-between gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">{i.name}</p>
              <p className="text-[11px] text-ink-soft">
                {brandingKindLabel(i.kind)}
                {i.size_spec ? ` · ${i.size_spec}` : ""}
                {i.sponsor ? ` · ${i.sponsor}` : ""} · {i.qty_owned} owned
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void deleteBrandingItem(i.id)
                  .then(onChanged)
                  .catch((e) => toast.error(String(e)))
              }
              className="shrink-0 rounded-lg bg-surface p-2 text-ink-soft ring-1 ring-border"
              aria-label="Delete item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {!items.length ? (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
            No branding kit captured yet.
          </li>
        ) : null}
      </ul>
    </>
  );
}
