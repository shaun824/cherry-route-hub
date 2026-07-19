import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useAdminStore, newId } from "@/lib/store";
import type { Event } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/events")({
  component: AdminEvents,
});

const gradients = [
  "from-[oklch(0.55_0.23_25)] to-[oklch(0.4_0.18_20)]",
  "from-[oklch(0.5_0.14_60)] to-[oklch(0.35_0.1_40)]",
  "from-[oklch(0.45_0.18_15)] to-[oklch(0.28_0.12_20)]",
  "from-[oklch(0.42_0.09_150)] to-[oklch(0.28_0.06_150)]",
  "from-[oklch(0.45_0.15_240)] to-[oklch(0.3_0.1_240)]",
];

function blank(): Event {
  return {
    id: newId("evt"),
    externalId: null,
    name: "",
    discipline: "Road Cycling",
    date: new Date(Date.now() + 30 * 86400000).toISOString(),
    location: "",
    distanceKm: 100,
    status: "open",
    heroColor: gradients[0],
    description: "",
    schedule: [],
    mapQuery: "",
    entered: false,
  };
}

function AdminEvents() {
  const events = useAdminStore((s) => s.events);
  const upsert = useAdminStore((s) => s.upsertEvent);
  const del = useAdminStore((s) => s.deleteEvent);
  const [editing, setEditing] = useState<Event | null>(null);

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Events</h1>
          <p className="text-sm text-ink-soft">Create, edit and remove race events.</p>
        </div>
        <button
          onClick={() => setEditing(blank())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> New event
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="hidden px-4 py-3 md:table-cell">Date</th>
              <th className="hidden px-4 py-3 md:table-cell">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{e.name || "(untitled)"}</p>
                  <p className="text-[11px] text-ink-soft">
                    {e.discipline} · {e.distanceKm}km · EN: {e.externalId ?? "—"}
                  </p>
                </td>
                <td className="hidden px-4 py-3 text-ink-soft md:table-cell">
                  {new Date(e.date).toLocaleDateString()}
                </td>
                <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{e.location}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => setEditing(e)}
                      className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${e.name}"?`)) del(e.id);
                      }}
                      className="rounded-md p-1.5 text-cherry hover:bg-accent"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-soft">
                  No events yet. Create one to get started.
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
        />
      ) : null}
    </div>
  );
}

function EventEditor({
  value,
  onSave,
  onCancel,
}: {
  value: Event;
  onSave: (e: Event) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Event>(value);
  const dateLocal = new Date(form.date).toISOString().slice(0, 16);

  function update<K extends keyof Event>(k: K, v: Event[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card shadow-xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <h3 className="font-display text-lg font-bold">
            {value.name ? "Edit event" : "New event"}
          </h3>
          <button onClick={onCancel} className="rounded-md p-1.5 text-ink-soft hover:bg-secondary">
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
          <Field label="Status">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => update("status", e.target.value as Event["status"])}
            >
              <option value="open">open</option>
              <option value="closed">closed</option>
              <option value="live">live</option>
              <option value="upcoming">upcoming</option>
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
          <Field label="Map query">
            <input
              className={inputCls}
              value={form.mapQuery}
              onChange={(e) => update("mapQuery", e.target.value)}
            />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <textarea
              className={`${inputCls} min-h-24`}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </Field>
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

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-cherry px-4 py-2 text-sm font-semibold text-white"
          >
            Save event
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
