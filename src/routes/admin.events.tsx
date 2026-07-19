import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Send,
  Archive,
  ArchiveRestore,
  Copy,
  GripVertical,
} from "lucide-react";
import { useAdminStore, newId } from "@/lib/store";
import type { Batch, EntryCategory, Event } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/events")({
  component: AdminEvents,
});

type Lifecycle = NonNullable<Event["lifecycle"]>;
const LIFECYCLES: Lifecycle[] = ["draft", "published", "archived"];

const gradients = [
  "from-[oklch(0.55_0.23_25)] to-[oklch(0.4_0.18_20)]",
  "from-[oklch(0.5_0.14_60)] to-[oklch(0.35_0.1_40)]",
  "from-[oklch(0.45_0.18_15)] to-[oklch(0.28_0.12_20)]",
  "from-[oklch(0.42_0.09_150)] to-[oklch(0.28_0.06_150)]",
  "from-[oklch(0.45_0.15_240)] to-[oklch(0.3_0.1_240)]",
];

const lifecycleOf = (e: Event): Lifecycle => e.lifecycle ?? "published";

function blank(): Event {
  return {
    id: newId("evt"),
    externalId: null,
    name: "",
    discipline: "Road Cycling",
    date: new Date(Date.now() + 30 * 86400000).toISOString(),
    location: "",
    distanceKm: 100,
    status: "upcoming",
    lifecycle: "draft",
    heroColor: gradients[0],
    description: "",
    schedule: [],
    mapQuery: "",
    entered: false,
    classes: [],
    batches: [],
  };
}

function AdminEvents() {
  const events = useAdminStore((s) => s.events);
  const upsert = useAdminStore((s) => s.upsertEvent);
  const del = useAdminStore((s) => s.deleteEvent);
  const [editing, setEditing] = useState<Event | null>(null);
  const [filter, setFilter] = useState<Lifecycle | "all">("all");

  const counts = useMemo(() => {
    const c: Record<Lifecycle | "all", number> = {
      all: events.length,
      draft: 0,
      published: 0,
      archived: 0,
    };
    for (const e of events) c[lifecycleOf(e)]++;
    return c;
  }, [events]);

  const filtered = filter === "all" ? events : events.filter((e) => lifecycleOf(e) === filter);

  const setLifecycle = (e: Event, next: Lifecycle) => upsert({ ...e, lifecycle: next });
  const duplicate = (e: Event) =>
    upsert({
      ...e,
      id: newId("evt"),
      name: `${e.name} (copy)`,
      lifecycle: "draft",
      entered: false,
      externalId: null,
    });

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Events</h1>
          <p className="text-sm text-ink-soft">
            Create, publish and archive events. Drafts & archived events are hidden from riders.
          </p>
        </div>
        <button
          onClick={() => setEditing(blank())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> New event
        </button>
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", ...LIFECYCLES] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ring-1 ${
              filter === k
                ? "bg-cherry text-white ring-cherry"
                : "bg-card text-ink-soft ring-border hover:bg-secondary"
            }`}
          >
            {k} <span className="opacity-70">· {counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="hidden px-4 py-3 md:table-cell">Date</th>
              <th className="hidden px-4 py-3 md:table-cell">Location</th>
              <th className="px-4 py-3">Lifecycle</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((e) => {
              const lc = lifecycleOf(e);
              return (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{e.name || "(untitled)"}</p>
                    <p className="text-[11px] text-ink-soft">
                      {e.discipline} · {e.distanceKm}km · {e.status} · EN:{" "}
                      {e.externalId ?? "—"}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-soft md:table-cell">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{e.location}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        lc === "published"
                          ? "bg-emerald-100 text-emerald-800"
                          : lc === "draft"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-secondary text-ink-soft"
                      }`}
                    >
                      {lc}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {lc !== "published" ? (
                        <button
                          onClick={() => setLifecycle(e, "published")}
                          className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                          aria-label="Publish"
                          title="Publish"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      ) : null}
                      {lc !== "archived" ? (
                        <button
                          onClick={() => setLifecycle(e, "archived")}
                          className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                          aria-label="Archive"
                          title="Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setLifecycle(e, "draft")}
                          className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                          aria-label="Restore"
                          title="Restore to draft"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => duplicate(e)}
                        className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                        aria-label="Duplicate"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditing(e)}
                        className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${e.name}"? This cannot be undone.`)) del(e.id);
                        }}
                        className="rounded-md p-1.5 text-cherry hover:bg-accent"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-soft">
                  Nothing here. {filter === "all" ? "Create an event to get started." : `No ${filter} events.`}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <EventEditor
          value={editing}
          onCancel={() => setEditing(null)}
          onSave={(next) => {
            upsert(next);
            setEditing(null);
          }}
          onSaveDraft={(next) => {
            upsert({ ...next, lifecycle: "draft" });
            setEditing(null);
          }}
          onPublish={(next) => {
            upsert({ ...next, lifecycle: "published" });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EventEditor({
  value,
  onSave,
  onSaveDraft,
  onPublish,
  onCancel,
}: {
  value: Event;
  onSave: (e: Event) => void;
  onSaveDraft: (e: Event) => void;
  onPublish: (e: Event) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Event>({ ...value, lifecycle: value.lifecycle ?? "published" });
  const dateLocal = new Date(form.date).toISOString().slice(0, 16);

  function update<K extends keyof Event>(k: K, v: Event[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const addScheduleItem = () =>
    update("schedule", [...form.schedule, { time: "08:00", label: "" }]);
  const updateScheduleItem = (i: number, patch: Partial<{ time: string; label: string }>) =>
    update(
      "schedule",
      form.schedule.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  const removeScheduleItem = (i: number) =>
    update(
      "schedule",
      form.schedule.filter((_, idx) => idx !== i),
    );
  const moveScheduleItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.schedule.length) return;
    const next = [...form.schedule];
    [next[i], next[j]] = [next[j], next[i]];
    update("schedule", next);
  };

  const canSave = form.name.trim().length > 0 && form.location.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-card shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div>
            <h3 className="font-display text-lg font-bold">
              {value.name ? "Edit event" : "New event"}
            </h3>
            <p className="text-[11px] text-ink-soft">
              Current lifecycle:{" "}
              <span className="font-semibold capitalize">{form.lifecycle ?? "published"}</span>
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Event name">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <Field label="Discipline">
            <input
              className={inputCls}
              value={form.discipline}
              onChange={(e) => update("discipline", e.target.value)}
            />
          </Field>
          <Field label="Date & time">
            <input
              type="datetime-local"
              className={inputCls}
              value={dateLocal}
              onChange={(e) => update("date", new Date(e.target.value).toISOString())}
            />
          </Field>
          <Field label="Location">
            <input
              className={inputCls}
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Prince Albert, Karoo"
            />
          </Field>
          <Field label="Distance (km)">
            <input
              type="number"
              className={inputCls}
              value={form.distanceKm}
              onChange={(e) => update("distanceKm", Number(e.target.value))}
            />
          </Field>
          <Field label="Entry status">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => update("status", e.target.value as Event["status"])}
            >
              <option value="upcoming">upcoming</option>
              <option value="open">open</option>
              <option value="live">live</option>
              <option value="closed">closed</option>
            </select>
          </Field>
          <Field label="Lifecycle">
            <select
              className={inputCls}
              value={form.lifecycle ?? "published"}
              onChange={(e) => update("lifecycle", e.target.value as Lifecycle)}
            >
              <option value="draft">draft (hidden from riders)</option>
              <option value="published">published (visible to riders)</option>
              <option value="archived">archived (hidden, kept in records)</option>
            </select>
          </Field>
          <Field label="Entry Ninja external ID">
            <input
              className={inputCls}
              value={form.externalId ?? ""}
              placeholder="en_evt_00000"
              onChange={(e) => update("externalId", e.target.value || null)}
            />
          </Field>
          <Field label="Map query" className="md:col-span-2">
            <input
              className={inputCls}
              value={form.mapQuery}
              onChange={(e) => update("mapQuery", e.target.value)}
              placeholder="e.g. Swartberg Pass, South Africa"
            />
            <span className="mt-1 block text-[11px] text-ink-soft">
              Used to embed a location map on the event page.
            </span>
          </Field>
          <Field label="Description" className="md:col-span-2">
            <textarea
              className={`${inputCls} min-h-24`}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </Field>

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                Schedule
              </span>
              <button
                type="button"
                onClick={addScheduleItem}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-ink"
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            </div>
            <ul className="space-y-2">
              {form.schedule.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveScheduleItem(i, -1)}
                      className="text-ink-soft hover:text-ink disabled:opacity-30"
                      disabled={i === 0}
                      aria-label="Move up"
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveScheduleItem(i, 1)}
                      className="text-ink-soft hover:text-ink disabled:opacity-30"
                      disabled={i === form.schedule.length - 1}
                      aria-label="Move down"
                    >
                      <GripVertical className="h-3 w-3 -rotate-90" />
                    </button>
                  </div>
                  <input
                    type="time"
                    className={`${inputCls} w-28`}
                    value={item.time}
                    onChange={(e) => updateScheduleItem(i, { time: e.target.value })}
                  />
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="e.g. Race briefing at start line"
                    value={item.label}
                    onChange={(e) => updateScheduleItem(i, { label: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeScheduleItem(i)}
                    className="rounded-md p-1.5 text-cherry hover:bg-accent"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {form.schedule.length === 0 ? (
                <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-ink-soft">
                  No schedule items yet. Add times like registration, briefing, start, cut-off.
                </li>
              ) : null}
            </ul>
          </div>

          <ClassesEditor
            classes={form.classes ?? []}
            onChange={(next) => update("classes", next)}
          />

          <BatchesEditor
            batches={form.batches ?? []}
            onChange={(next) => update("batches", next)}
          />



          <Field label="Hero gradient" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {gradients.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => update("heroColor", g)}
                  className={`h-10 w-16 rounded-lg bg-gradient-to-br ${g} ring-2 ${
                    form.heroColor === g ? "ring-cherry" : "ring-transparent"
                  }`}
                />
              ))}
            </div>
          </Field>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={!canSave}
            onClick={() => onSaveDraft(form)}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Save as draft
          </button>
          <button
            disabled={!canSave}
            onClick={() => onSave(form)}
            className="rounded-lg border border-cherry/30 bg-accent px-4 py-2 text-sm font-semibold text-cherry disabled:opacity-50"
          >
            Save
          </button>
          <button
            disabled={!canSave}
            onClick={() => onPublish(form)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Publish
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cherry focus:ring-2 focus:ring-cherry/20";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}
