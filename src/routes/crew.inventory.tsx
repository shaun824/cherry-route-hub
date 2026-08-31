// Crew inventory management: the full event load-out. One master kit catalogue,
// a per-event load list grouped by section, the vehicle runs that move it, and
// shared Packed → On site → Setup → Returned ticks for PE and the field team.
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Check, Loader2, MapPin, Package, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin, useIsCrew } from "@/lib/auth";
import { useCrewEvent } from "@/lib/crew-event";
import { fetchAllCrewEvents, fetchCrewEvents } from "@/lib/crew";
import { fetchDepartments } from "@/lib/run-sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  INVENTORY_CATEGORIES,
  LOAD_STAGES,
  LOCATIONS,
  addLoadLine,
  categoryLabel,
  deleteInventoryItem,
  deleteLoadLine,
  deleteRun,
  fetchInventoryItems,
  fetchLoadList,
  fetchRuns,
  groupByCategory,
  locationLabel,
  locationShort,
  packingLine,
  qtyText,
  saveInventoryItem,
  saveRun,
  setStage,
  stageDone,
  totalsByLocation,
  updateLoadLine,
  type InventoryItem,
  type LoadLine,
  type LogisticsRun,
} from "@/lib/inventory";

export const Route = createFileRoute("/crew/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory management · Red Cherry Crew" },
      {
        name: "description",
        content:
          "Crew tool: the full event load-out — master kit catalogue, per-event load list, vehicle runs and shared packed / on site / setup / returned ticks.",
      },
      { property: "og:title", content: "Inventory management · Red Cherry Crew" },
      {
        property: "og:description",
        content: "Everything the event needs, who is driving it there, and where each item has got to.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InventoryPage,
});

const inputCls = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";

function InventoryPage() {
  const { isCrew, loading, user } = useIsCrew();
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"load" | "runs" | "catalogue">("load");
  const [showPast, setShowPast] = useState(false);

  const eventsQ = useQuery({
    queryKey: ["crew-events", showPast ? "all" : "current"],
    queryFn: showPast ? fetchAllCrewEvents : fetchCrewEvents,
    enabled: isCrew,
  });
  const events = eventsQ.data ?? [];
  const [eventId, setEventId] = useCrewEvent(events);

  const itemsQ = useQuery({ queryKey: ["inventory-items"], queryFn: fetchInventoryItems, enabled: isCrew });
  const linesQ = useQuery({
    queryKey: ["load-list", eventId],
    queryFn: () => fetchLoadList(eventId),
    enabled: isCrew && !!eventId,
  });
  const runsQ = useQuery({
    queryKey: ["logistics-runs", eventId],
    queryFn: () => fetchRuns(eventId),
    enabled: isCrew && !!eventId,
  });
  const deptQ = useQuery({
    queryKey: ["crew-departments", eventId],
    queryFn: () => fetchDepartments(eventId),
    enabled: isCrew && !!eventId,
  });

  const items = itemsQ.data ?? [];
  const lines = linesQ.data ?? [];
  const runs = runsQ.data ?? [];
  const departments = deptQ.data ?? [];
  const groups = useMemo(() => groupByCategory(lines), [lines]);
  const locTotals = useMemo(() => totalsByLocation(lines), [lines]);
  const toPack = lines.filter((l) => !stageDone(l, "packed")).length;

  const refresh = () => qc.invalidateQueries({ queryKey: ["load-list", eventId] });

  // Add-to-load-list form
  const [pickId, setPickId] = useState("");
  const [freeName, setFreeName] = useState("");
  const [cat, setCat] = useState<string>("start_finish");
  const [qty, setQty] = useState(1);
  const [loc, setLoc] = useState("pe");
  const [placement, setPlacement] = useState("");
  const [deptId, setDeptId] = useState("");

  async function addLine() {
    const item = items.find((i) => i.id === pickId) ?? null;
    const name = item?.name ?? freeName.trim();
    if (!name) return toast.error("Pick an item or type a name.");
    try {
      await addLoadLine({
        eventId,
        item,
        name,
        category: item?.category ?? cat,
        location: loc,
        qty,
        placement: placement.trim() || null,
        departmentId: deptId || null,
        sortOrder: lines.length,
      });
      setFreeName("");
      setQty(1);
      setPlacement("");
      await refresh();
      toast.success(`${name} added to the load list`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add that.");
    }
  }

  async function pushToPacking(category?: string) {
    if (!isAdmin) return;
    if (!deptId) return toast.error("Choose the department that packs this first.");
    const rows = lines
      .filter((l) => !category || l.category === category)
      .map((l, i) => ({
        event_id: eventId,
        department_id: deptId,
        item: packingLine(l),
        qty: qtyText(l),
        notes: l.placement ?? null,
        source: "inventory",
        sort_order: i,
      }));
    if (!rows.length) return toast.error("Nothing on the load list yet.");
    const { error } = await supabase.from("department_packing_items").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} items added to the packing list`);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (!user || !isCrew) return <Navigate to="/crew/login" />;

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
            Everything this event needs, where it comes from, who is driving it there, and how far each
            item has got: packed in PE, on site, set up, and back home again.
          </p>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-2">
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-ink"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-bold ring-1 ring-border ${
            showPast ? "bg-cherry text-white" : "bg-surface text-ink-soft"
          }`}
        >
          Past events
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
        {(["load", "runs", "catalogue"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full py-1.5 text-xs font-bold transition ${
              tab === t ? "bg-card text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {t === "load" ? "Load list" : t === "runs" ? "Logistics" : "Catalogue"}
          </button>
        ))}
      </div>

      {tab === "load" ? (
        <>
          <section className="mt-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <h2 className="font-display text-sm font-bold text-ink">Add to the load list</h2>
            <div className="mt-3 space-y-2">
              <select value={pickId} onChange={(e) => setPickId(e.target.value)} className={inputCls}>
                <option value="">From the catalogue…</option>
                {items
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {categoryLabel(i.category)} · {i.name}
                      {i.qty_owned ? ` · ${i.qty_owned} owned` : ""}
                    </option>
                  ))}
              </select>
              {!pickId ? (
                <div className="flex gap-2">
                  <input
                    value={freeName}
                    onChange={(e) => setFreeName(e.target.value)}
                    placeholder="…or type a one-off item"
                    className={inputCls}
                  />
                  <select
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                    className="w-40 shrink-0 rounded-xl border border-border bg-surface px-2 py-2 text-sm"
                  >
                    {INVENTORY_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-20 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                  aria-label="Quantity"
                />
                <select
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                >
                  {LOCATIONS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                placeholder="Where does it go / notes"
                className={inputCls}
              />
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputCls}>
                <option value="">No department yet</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void addLine()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-cherry px-3 py-2.5 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Add to this event
              </button>
            </div>
          </section>

          {lines.length ? (
            <section className="mt-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
              <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
                <Package className="h-4 w-4 text-cherry" /> {lines.length} lines · {toPack} still to pack
              </h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {locTotals.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-ink-soft ring-1 ring-border"
                  >
                    {t.count} × {t.label}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-ink-soft">
                Branding lines still get dropped onto the{" "}
                <Link to="/crew/build" className="font-semibold text-cherry underline">
                  build map
                </Link>
                .
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => void pushToPacking()}
                  className="mt-3 w-full rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"
                >
                  Push the whole load list to the selected department
                </button>
              ) : null}
            </section>
          ) : null}

          {groups.map((g) => (
            <section key={g.category} className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-ink">{g.label}</h3>
                <span className="text-[11px] font-semibold text-ink-soft">{g.items.length} lines</span>
              </div>
              <ul className="mt-2 space-y-2">
                {g.items.map((l) => (
                  <LoadRow key={l.id} line={l} userId={user?.id ?? null} onChanged={refresh} runs={runs} />
                ))}
              </ul>
            </section>
          ))}
          {!lines.length && !linesQ.isLoading ? (
            <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
              Nothing loaded for this event yet.
            </p>
          ) : null}
        </>
      ) : tab === "runs" ? (
        <RunsTab
          eventId={eventId}
          runs={runs}
          onChanged={() => qc.invalidateQueries({ queryKey: ["logistics-runs", eventId] })}
        />
      ) : (
        <CatalogueTab items={items} onChanged={() => qc.invalidateQueries({ queryKey: ["inventory-items"] })} />
      )}
    </div>
  );
}

function LoadRow({
  line,
  userId,
  runs,
  onChanged,
}: {
  line: LoadLine;
  userId: string | null;
  runs: LogisticsRun[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle(stage: (typeof LOAD_STAGES)[number]["id"]) {
    setBusy(true);
    try {
      await setStage(line, stage, !stageDone(line, stage), userId);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {qtyText(line)} × {line.name}
          </p>
          <p className="text-[11px] text-ink-soft">
            {locationShort(line.location)}
            {line.size_spec ? ` · ${line.size_spec}` : ""}
            {line.placement ? ` · ${line.placement}` : ""}
          </p>
          {line.village_spot_id ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-cherry">
              <MapPin className="h-3 w-3" /> Placed on the village map
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() =>
            void deleteLoadLine(line.id)
              .then(onChanged)
              .catch((e) => toast.error(String(e)))
          }
          className="shrink-0 rounded-lg bg-surface p-2 text-ink-soft ring-1 ring-border"
          aria-label="Remove line"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {LOAD_STAGES.map((s) => {
          const done = stageDone(line, s.id);
          return (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              onClick={() => void toggle(s.id)}
              className={`rounded-lg py-2 text-[11px] font-bold transition disabled:opacity-60 ${
                done ? "bg-cherry text-white" : "bg-surface text-ink-soft ring-1 ring-border"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {runs.length ? (
        <select
          value={line.run_id ?? ""}
          onChange={(e) =>
            void updateLoadLine(line.id, { run_id: e.target.value || null })
              .then(onChanged)
              .catch((err) => toast.error(String(err)))
          }
          className="mt-2 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[11px]"
        >
          <option value="">Not assigned to a vehicle run</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.run_date ?? "Date TBC"} · {r.vehicle ?? "Vehicle TBC"}
              {r.driver ? ` · ${r.driver}` : ""}
            </option>
          ))}
        </select>
      ) : null}
    </li>
  );
}

function RunsTab({
  eventId,
  runs,
  onChanged,
}: {
  eventId: string;
  runs: LogisticsRun[];
  onChanged: () => void;
}) {
  const [date, setDate] = useState("");
  const [direction, setDirection] = useState("out");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [taking, setTaking] = useState("");

  async function add() {
    if (!eventId) return;
    try {
      await saveRun({
        event_id: eventId,
        run_date: date || null,
        direction,
        driver: driver.trim() || null,
        vehicle: vehicle.trim() || null,
        taking: taking.trim() || null,
        sort_order: runs.length,
      });
      setDriver("");
      setVehicle("");
      setTaking("");
      onChanged();
      toast.success("Run added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that run.");
    }
  }

  return (
    <>
      <section className="mt-4 space-y-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <h2 className="font-display text-sm font-bold text-ink">Add a vehicle run</h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            aria-label="Run date"
          />
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="w-32 shrink-0 rounded-xl border border-border bg-surface px-2 py-2 text-sm"
          >
            <option value="out">Out to site</option>
            <option value="return">Return</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Vehicle, e.g. 8 Ton Green Motion"
            className={inputCls}
          />
          <input
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            placeholder="Driver(s)"
            className={inputCls}
          />
        </div>
        <textarea
          value={taking}
          onChange={(e) => setTaking(e.target.value)}
          placeholder="Taking: what goes on this run"
          rows={2}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => void add()}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-cherry px-3 py-2.5 text-sm font-bold text-white"
        >
          <Truck className="h-4 w-4" /> Add run
        </button>
      </section>

      <ul className="mt-4 space-y-2">
        {runs.map((r) => (
          <li key={r.id} className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {r.run_date ?? "Date TBC"} · {r.direction === "return" ? "Return" : "Out to site"}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {r.vehicle ?? "Vehicle TBC"}
                  {r.driver ? ` · ${r.driver}` : ""}
                </p>
                {r.taking ? <p className="mt-1 text-xs text-ink-soft">{r.taking}</p> : null}
              </div>
              <button
                type="button"
                onClick={() =>
                  void deleteRun(r.id)
                    .then(onChanged)
                    .catch((e) => toast.error(String(e)))
                }
                className="shrink-0 rounded-lg bg-surface p-2 text-ink-soft ring-1 ring-border"
                aria-label="Delete run"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
        {!runs.length ? (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
            No vehicle runs planned for this event yet.
          </li>
        ) : null}
      </ul>
    </>
  );
}

function CatalogueTab({ items, onChanged }: { items: InventoryItem[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("start_finish");
  const [home, setHome] = useState("pe");
  const [size, setSize] = useState("");
  const [owned, setOwned] = useState(0);
  const [filter, setFilter] = useState("");

  const shown = filter ? items.filter((i) => i.category === filter) : items;

  async function add() {
    if (!name.trim()) return toast.error("Give the item a name.");
    try {
      await saveInventoryItem({
        name,
        category,
        home_location: home,
        size_spec: size.trim() || null,
        qty_owned: owned,
      });
      setName("");
      setSize("");
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
        <h2 className="font-display text-sm font-bold text-ink">Add kit to the catalogue</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name, e.g. Bedouin tent 6×12"
          className={inputCls}
        />
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
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
          />
        </div>
        <div className="flex gap-2">
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Size / spec"
            className={inputCls}
          />
          <select
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            {LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void add()}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-cherry px-3 py-2.5 text-sm font-bold text-white"
        >
          <Check className="h-4 w-4" /> Add to catalogue
        </button>
      </section>

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mt-4 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-ink"
      >
        <option value="">All categories</option>
        {INVENTORY_CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <ul className="mt-3 space-y-2">
        {shown.map((i) => (
          <li
            key={i.id}
            className="flex items-start justify-between gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">{i.name}</p>
              <p className="text-[11px] text-ink-soft">
                {categoryLabel(i.category)}
                {i.size_spec ? ` · ${i.size_spec}` : ""} · {locationLabel(i.home_location)} · {i.qty_owned}{" "}
                owned
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void deleteInventoryItem(i.id)
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
        {!shown.length ? (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
            No kit captured yet.
          </li>
        ) : null}
      </ul>
    </>
  );
}
