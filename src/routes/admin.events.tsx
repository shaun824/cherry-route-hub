import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
  Upload,
  Loader2,
} from "lucide-react";
import { useAdminStore, newId } from "@/lib/store";
import type { Batch, BatchPrice, CustomMarker, EntryCategory, Event, EventDay, EventRoute, RouteTier, ScheduleItem } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";

async function uploadEventImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("event-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("event-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Sign URL failed");
  return data.signedUrl;
}

async function uploadEventKml(file: File): Promise<{ url: string; path: string }> {
  const safe = file.name.replace(/[^a-z0-9._-]+/gi, "-");
  const path = `${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage
    .from("event-kmls")
    .upload(path, file, { contentType: file.type || "application/vnd.google-earth.kml+xml", upsert: false });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("event-kmls")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Sign URL failed");
  return { url: data.signedUrl, path };
}

async function deleteEventKml(url: string): Promise<void> {
  const bare = url.split("?")[0];
  const match = bare.match(/\/event-kmls\/(.+)$/);
  if (!match) return;
  await supabase.storage.from("event-kmls").remove([decodeURIComponent(match[1])]);
}



function ImageUploadButton({
  onUploaded,
  label,
}: {
  onUploaded: (url: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setErr(null);
          try {
            const url = await uploadEventImage(file);
            onUploaded(url);
          } catch (e2) {
            setErr(e2 instanceof Error ? e2.message : "Upload failed");
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Uploading…" : label}
      </button>
      {err ? <p className="mt-1 text-[11px] font-semibold text-cherry">{err}</p> : null}
    </>
  );
}

function KmlManager({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileName = (u: string) => {
    try {
      return decodeURIComponent(u.split("/").pop() ?? u).replace(/^[0-9a-f-]{36}-/i, "");
    } catch {
      return u;
    }
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          Route maps (KML / GPX)
        </span>
        <input
          ref={ref}
          type="file"
          accept=".kml,.gpx,application/vnd.google-earth.kml+xml,application/gpx+xml,application/xml,text/xml"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length === 0) return;
            setBusy(true);
            setErr(null);
            try {
              const uploaded: string[] = [];
              for (const f of files) {
                const { url } = await uploadEventKml(f);
                uploaded.push(url);
              }
              onChange([...urls, ...uploaded]);
            } catch (e2) {
              setErr(e2 instanceof Error ? e2.message : "Upload failed");
            } finally {
              setBusy(false);
              if (ref.current) ref.current.value = "";
            }
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => ref.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-surface disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {busy ? "Uploading…" : "Add KML"}
        </button>
      </div>
      {urls.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] text-ink-soft">
          No KML files yet. Upload one or more — riders can pan, zoom and see every waypoint on the map.
        </p>
      ) : (
        <ul className="space-y-1">
          {urls.map((u) => (
            <li
              key={u}
              className="flex items-center justify-between gap-2 rounded-md bg-secondary px-2 py-1 text-[11px]"
            >
              <span className="truncate font-mono text-ink" title={u}>
                {fileName(u)}
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange(urls.filter((x) => x !== u));
                  void deleteEventKml(u);
                }}
                className="text-ink-soft hover:text-cherry"
                aria-label="Remove KML"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {err ? <p className="mt-1 text-[11px] font-semibold text-cherry">{err}</p> : null}
    </div>
  );
}

const MARKER_ICONS: NonNullable<CustomMarker["icon"]>[] = [
  "pin",
  "start",
  "finish",
  "aid",
  "warning",
  "photo",
  "food",
  "water",
];
const MARKER_ICON_GLYPH: Record<NonNullable<CustomMarker["icon"]>, string> = {
  pin: "📍",
  start: "🚩",
  finish: "🏁",
  aid: "🩹",
  warning: "⚠️",
  photo: "📷",
  food: "🍎",
  water: "💧",
};

function CustomMarkerEditor({
  markers,
  onChange,
}: {
  markers: CustomMarker[];
  onChange: (m: CustomMarker[]) => void;
}) {
  function add() {
    onChange([
      ...markers,
      { id: crypto.randomUUID(), name: "New marker", lat: 0, lng: 0, icon: "pin" },
    ]);
  }
  function update(id: string, patch: Partial<CustomMarker>) {
    onChange(markers.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function remove(id: string) {
    onChange(markers.filter((m) => m.id !== id));
  }

  async function pasteGoogleMapsUrl(id: string) {
    const url = window.prompt(
      "Paste a Google Maps link (e.g. https://maps.google.com/?q=-33.9,18.4 or a full share URL)",
    );
    if (!url) return;
    // Try to pull lat,lng from common Google Maps URL forms.
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/, // /@lat,lng
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /ll=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /destination=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    ];
    for (const rx of patterns) {
      const m = url.match(rx);
      if (m) {
        update(id, { lat: Number(m[1]), lng: Number(m[2]) });
        return;
      }
    }
    alert("Could not read coordinates from that link. Right‑click a point in Google Maps and copy the numeric coordinates.");
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          Custom markers
        </span>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-surface"
        >
          <Plus className="h-3 w-3" /> Add marker
        </button>
      </div>
      {markers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] text-ink-soft">
          No custom markers yet. Add start/finish, water tables, warnings or photo spots.
        </p>
      ) : (
        <ul className="space-y-2">
          {markers.map((m) => (
            <li key={m.id} className="rounded-md bg-secondary p-2">
              <div className="flex items-center gap-2">
                <select
                  value={m.icon ?? "pin"}
                  onChange={(e) => update(m.id, { icon: e.target.value as CustomMarker["icon"] })}
                  className="rounded border border-border bg-background px-1.5 py-1 text-[11px]"
                >
                  {MARKER_ICONS.map((k) => (
                    <option key={k} value={k}>
                      {MARKER_ICON_GLYPH[k]} {k}
                    </option>
                  ))}
                </select>
                <input
                  value={m.name}
                  onChange={(e) => update(m.id, { name: e.target.value })}
                  placeholder="Marker name"
                  className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[11px]"
                />
                <input
                  type="color"
                  value={m.color ?? "#e11d48"}
                  onChange={(e) => update(m.id, { color: e.target.value })}
                  className="h-6 w-8 shrink-0 rounded border border-border"
                  aria-label="Marker colour"
                />
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  className="text-ink-soft hover:text-cherry"
                  aria-label="Remove marker"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  step="0.000001"
                  value={m.lat}
                  onChange={(e) => update(m.id, { lat: Number(e.target.value) })}
                  placeholder="Latitude"
                  className="rounded border border-border bg-background px-2 py-1 text-[11px]"
                />
                <input
                  type="number"
                  step="0.000001"
                  value={m.lng}
                  onChange={(e) => update(m.id, { lng: Number(e.target.value) })}
                  placeholder="Longitude"
                  className="rounded border border-border bg-background px-2 py-1 text-[11px]"
                />
              </div>
              <input
                value={m.description ?? ""}
                onChange={(e) => update(m.id, { description: e.target.value || undefined })}
                placeholder="Description (optional)"
                className="mt-1.5 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => pasteGoogleMapsUrl(m.id)}
                  className="rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold hover:bg-surface"
                >
                  Paste Google Maps link
                </button>
                <a
                  href={`https://www.google.com/maps/@${m.lat || 0},${m.lng || 0},15z`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold hover:bg-surface"
                >
                  Open in Google Maps ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}




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

  const addScheduleItem = (dayId?: string) =>
    update("schedule", [
      ...form.schedule,
      { time: "08:00", label: "", details: "", dayId },
    ]);
  const updateScheduleItem = (i: number, patch: Partial<ScheduleItem>) =>
    update(
      "schedule",
      form.schedule.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  const removeScheduleItem = (i: number) =>
    update(
      "schedule",
      form.schedule.filter((_, idx) => idx !== i),
    );
  const moveScheduleItemWithin = (i: number, dir: -1 | 1) => {
    const item = form.schedule[i];
    const siblings = form.schedule
      .map((s, idx) => ({ s, idx }))
      .filter((x) => (x.s.dayId ?? "") === (item.dayId ?? ""));
    const pos = siblings.findIndex((x) => x.idx === i);
    const targetPos = pos + dir;
    if (targetPos < 0 || targetPos >= siblings.length) return;
    const j = siblings[targetPos].idx;
    const next = [...form.schedule];
    [next[i], next[j]] = [next[j], next[i]];
    update("schedule", next);
  };
  const addDayFromSchedule = () => {
    const existing = form.days ?? [];
    const newDay: EventDay = {
      id: newId("day"),
      date: new Date(Date.now() + (existing.length + 1) * 86400000).toISOString().slice(0, 10),
      label: `Day ${existing.length + 1}`,
      routes: [],
    };
    update("days", [...existing, newDay]);
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
          <Field label="Spectator mode">
            <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.spectatorMode ?? false}
                onChange={(e) => update("spectatorMode", e.target.checked)}
              />
              <span>
                Open to spectators
                <span className="ml-1 text-[11px] text-ink-soft">
                  (unlocks the event card on the public Spectate tab)
                </span>
              </span>
            </label>
          </Field>
          <Field label="Entry Ninja external ID">
            <input
              className={inputCls}
              value={form.externalId ?? ""}
              placeholder="en_evt_00000"
              onChange={(e) => update("externalId", e.target.value || null)}
            />
          </Field>
          <Field label="Venue (Google Maps)" className="md:col-span-2">
            <input
              className={inputCls}
              value={form.mapQuery}
              onChange={(e) => update("mapQuery", e.target.value)}
              placeholder="e.g. Coetzenburg Stadium, Stellenbosch — or paste lat,lng"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.mapQuery || form.location || "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold hover:bg-surface"
              >
                Find venue on Google Maps ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  const url = window.prompt(
                    "Paste the Google Maps share link for the venue (open Google Maps → find the place → Share → Copy link)",
                  );
                  if (!url) return;
                  const patterns = [
                    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
                    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
                    /q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
                    /ll=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
                    /destination=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
                  ];
                  for (const rx of patterns) {
                    const m = url.match(rx);
                    if (m) {
                      update("mapQuery", `${m[1]},${m[2]}`);
                      return;
                    }
                  }
                  alert(
                    "Could not read coordinates from that link. Open the venue in Google Maps, right-click the exact spot, then click the numeric coordinates at the top of the menu to copy them, and paste those here.",
                  );
                }}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold hover:bg-surface"
              >
                Paste share link → pin exact spot
              </button>
            </div>
            <span className="mt-1 block text-[11px] text-ink-soft">
              This drives the embedded map and the "Navigate" button on the event page. Paste a share link to pin the exact venue by coordinates.
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
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              Social media (follow this event)
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {([
                ["website", "Website"],
                ["facebook", "Facebook"],
                ["instagram", "Instagram"],
                ["twitter", "X / Twitter"],
                ["youtube", "YouTube"],
                ["tiktok", "TikTok"],
                ["strava", "Strava club"],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    className={inputCls}
                    value={form.socialLinks?.[key] ?? ""}
                    placeholder="https://…"
                    onChange={(e) =>
                      update("socialLinks", {
                        ...(form.socialLinks ?? {}),
                        [key]: e.target.value || undefined,
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </div>


          <Field label="Event logo">
            <input
              className={inputCls}
              value={form.logoUrl ?? ""}
              placeholder="Upload or paste a URL"
              onChange={(e) => update("logoUrl", e.target.value || undefined)}
            />
            <div className="mt-2 flex items-center gap-2">
              <ImageUploadButton
                label={form.logoUrl ? "Replace logo" : "Upload logo"}
                onUploaded={(url) => update("logoUrl", url)}
              />
              {form.logoUrl ? (
                <button
                  type="button"
                  onClick={() => update("logoUrl", undefined)}
                  className="text-[11px] font-semibold text-ink-soft hover:text-cherry"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {form.logoUrl ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                <img src={form.logoUrl} alt="Logo preview" className="h-10 w-10 rounded object-contain" />
                <span className="text-[11px] text-ink-soft">Logo preview</span>
              </div>
            ) : null}
          </Field>
          <Field label="Cover image">
            <input
              className={inputCls}
              value={form.coverUrl ?? ""}
              placeholder="Upload or paste a URL"
              onChange={(e) => update("coverUrl", e.target.value || undefined)}
            />
            <div className="mt-2 flex items-center gap-2">
              <ImageUploadButton
                label={form.coverUrl ? "Replace cover" : "Upload cover"}
                onUploaded={(url) => update("coverUrl", url)}
              />
              {form.coverUrl ? (
                <button
                  type="button"
                  onClick={() => update("coverUrl", undefined)}
                  className="text-[11px] font-semibold text-ink-soft hover:text-cherry"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {form.coverUrl ? (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <img src={form.coverUrl} alt="Cover preview" className="h-24 w-full object-cover" />
              </div>
            ) : null}
          </Field>


          <DaysEditor
            days={form.days ?? []}
            onChange={(next) => update("days", next)}
          />

          <div className="md:col-span-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                  Schedule
                </span>
                <p className="text-[11px] text-ink-soft">
                  Group schedule items by day. Add a day, then add each item under the day it belongs to.
                </p>
              </div>
              <button
                type="button"
                onClick={addDayFromSchedule}
                className="inline-flex items-center gap-1 rounded-md bg-cherry px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Add day
              </button>
            </div>

            {(() => {
              const days = form.days ?? [];
              const indexed = form.schedule.map((s, idx) => ({ s, idx }));
              const groups: { key: string; heading: string; sub?: string; dayId?: string; items: typeof indexed }[] = [];
              days.forEach((d, di) => {
                groups.push({
                  key: d.id,
                  heading: d.label || `Day ${di + 1}`,
                  sub: d.date ? new Date(d.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : undefined,
                  dayId: d.id,
                  items: indexed
                    .filter((x) => x.s.dayId === d.id)
                    .sort((a, b) => (a.s.time || "").localeCompare(b.s.time || "")),
                });
              });
              const orphans = indexed.filter((x) => !x.s.dayId || !days.some((d) => d.id === x.s.dayId));
              if (orphans.length > 0 || days.length === 0) {
                groups.push({
                  key: "__unscheduled",
                  heading: days.length === 0 ? "Schedule" : "Unscheduled",
                  sub: days.length === 0 ? "No days added yet — items will show without a day heading." : "Items not linked to a day. Assign one below.",
                  dayId: undefined,
                  items: orphans.sort((a, b) => (a.s.time || "").localeCompare(b.s.time || "")),
                });
              }

              return (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <section key={g.key} className="rounded-xl border border-border bg-background/60 p-3">
                      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-display text-sm font-bold text-ink">{g.heading}</div>
                          {g.sub ? <div className="text-[11px] text-ink-soft">{g.sub}</div> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => addScheduleItem(g.dayId)}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-ink hover:bg-accent"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add time
                        </button>
                      </header>

                      {g.items.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-ink-soft">
                          No items yet for this day. Add registration, briefing, start, cut-off…
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {g.items.map(({ s: item, idx: i }, localIdx) => (
                            <li key={i} className="rounded-lg border border-border bg-card p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                                  {item.time || "--:--"}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveScheduleItemWithin(i, -1)}
                                    disabled={localIdx === 0}
                                    className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                                    aria-label="Move up"
                                  >
                                    <GripVertical className="h-3 w-3 rotate-90" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveScheduleItemWithin(i, 1)}
                                    disabled={localIdx === g.items.length - 1}
                                    className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                                    aria-label="Move down"
                                  >
                                    <GripVertical className="h-3 w-3 -rotate-90" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeScheduleItem(i)}
                                    className="rounded-md p-1 text-cherry hover:bg-accent"
                                    aria-label="Remove"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[7rem_1fr]">
                                <input
                                  type="time"
                                  className={inputCls}
                                  value={item.time}
                                  onChange={(e) => updateScheduleItem(i, { time: e.target.value })}
                                />
                                <input
                                  className={inputCls}
                                  placeholder="Title (e.g. Race briefing at start line)"
                                  value={item.label}
                                  onChange={(e) => updateScheduleItem(i, { label: e.target.value })}
                                />
                              </div>
                              <textarea
                                className={`${inputCls} mt-2 min-h-20`}
                                placeholder="Details (optional) — meeting point, kit, what to bring, notes for riders…"
                                value={item.details ?? ""}
                                onChange={(e) => updateScheduleItem(i, { details: e.target.value })}
                              />
                              {(form.days?.length ?? 0) > 0 ? (
                                <div className="mt-2">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                                    Day
                                  </label>
                                  <select
                                    className={inputCls}
                                    value={item.dayId ?? ""}
                                    onChange={(e) =>
                                      updateScheduleItem(i, { dayId: e.target.value || undefined })
                                    }
                                  >
                                    <option value="">— No day —</option>
                                    {(form.days ?? []).map((d, didx) => (
                                      <option key={d.id} value={d.id}>
                                        {d.label || `Day ${didx + 1}`} {d.date ? `· ${d.date}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              );
            })()}
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

function ClassesEditor({
  classes,
  onChange,
}: {
  classes: EntryCategory[];
  onChange: (next: EntryCategory[]) => void;
}) {
  const add = () =>
    onChange([
      ...classes,
      {
        id: newId("cls"),
        label: "New class",
        distanceKm: 0,
        priceZAR: 0,
        description: "",
      },
    ]);
  const update = (i: number, patch: Partial<EntryCategory>) =>
    onChange(classes.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(classes.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= classes.length) return;
    const next = [...classes];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="md:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Classes / categories
          </span>
          <p className="text-[11px] text-ink-soft">
            Distances and pricing riders can pick from. Leave empty to fall back to defaults.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-ink"
        >
          <Plus className="h-3.5 w-3.5" /> Add class
        </button>
      </div>
      <ul className="space-y-2">
        {classes.map((c, i) => (
          <li key={c.id} className="rounded-lg border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                Class {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                  aria-label="Move up"
                >
                  <GripVertical className="h-3 w-3 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === classes.length - 1}
                  className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                  aria-label="Move down"
                >
                  <GripVertical className="h-3 w-3 -rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-md p-1 text-cherry hover:bg-accent"
                  aria-label="Remove class"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <input
                className={inputCls}
                placeholder="Label (e.g. Elite 100km)"
                value={c.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
              <input
                type="number"
                className={inputCls}
                placeholder="Distance km"
                value={c.distanceKm}
                onChange={(e) => update(i, { distanceKm: Number(e.target.value) })}
              />
              <input
                type="number"
                className={inputCls}
                placeholder="Price ZAR"
                value={c.priceZAR}
                onChange={(e) => update(i, { priceZAR: Number(e.target.value) })}
              />
              <input
                className={inputCls}
                placeholder="ID (auto)"
                value={c.id}
                onChange={(e) => update(i, { id: e.target.value })}
              />
              <input
                className={`${inputCls} md:col-span-4`}
                placeholder="Description shown to riders"
                value={c.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </div>
          </li>
        ))}
        {classes.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-ink-soft">
            No custom classes. The event will use the default classes for its template.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function BatchesEditor({
  batches,
  onChange,
}: {
  batches: Batch[];
  onChange: (next: Batch[]) => void;
}) {
  const add = () =>
    onChange([
      ...batches,
      {
        id: newId("btc"),
        name: `Batch ${batches.length + 1}`,
        startTime: "07:00",
        capacity: undefined,
        description: "",
      },
    ]);
  const update = (i: number, patch: Partial<Batch>) =>
    onChange(batches.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(batches.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= batches.length) return;
    const next = [...batches];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="md:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Start batches / waves
          </span>
          <p className="text-[11px] text-ink-soft">
            Riders pick a batch at entry. Leave empty to skip the batch step.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-ink"
        >
          <Plus className="h-3.5 w-3.5" /> Add batch
        </button>
      </div>
      <ul className="space-y-2">
        {batches.map((b, i) => (
          <li key={b.id} className="rounded-lg border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                Batch {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                  aria-label="Move up"
                >
                  <GripVertical className="h-3 w-3 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === batches.length - 1}
                  className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                  aria-label="Move down"
                >
                  <GripVertical className="h-3 w-3 -rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-md p-1 text-cherry hover:bg-accent"
                  aria-label="Remove batch"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <input
                className={inputCls}
                placeholder="Batch name (e.g. A Bunch)"
                value={b.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <input
                type="time"
                className={inputCls}
                value={b.startTime}
                onChange={(e) => update(i, { startTime: e.target.value })}
              />
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="Capacity (opt)"
                value={b.capacity ?? ""}
                onChange={(e) =>
                  update(i, {
                    capacity: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
              <input
                className={inputCls}
                placeholder="ID (auto)"
                value={b.id}
                onChange={(e) => update(i, { id: e.target.value })}
              />
              <input
                className={`${inputCls} md:col-span-4`}
                placeholder="Description (e.g. Seeded, licensed riders)"
                value={b.description ?? ""}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </div>
            <BatchPricesEditor
              prices={b.prices ?? []}
              onChange={(next) => update(i, { prices: next })}
            />
          </li>
        ))}
        {batches.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-ink-soft">
            No batches. Riders won't pick a start wave at entry.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function BatchPricesEditor({
  prices,
  onChange,
}: {
  prices: BatchPrice[];
  onChange: (next: BatchPrice[]) => void;
}) {
  const add = () =>
    onChange([
      ...prices,
      {
        id: newId("prc"),
        label: prices.length === 0 ? "Early Bird" : prices.length === 1 ? "Regular" : "Late Entry",
        priceZAR: 0,
        expiresAt: "",
      },
    ]);
  const upd = (i: number, patch: Partial<BatchPrice>) =>
    onChange(prices.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const rm = (i: number) => onChange(prices.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= prices.length) return;
    const next = [...prices];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const toLocal = (iso?: string) => {
    if (!iso) return "";
    try { return new Date(iso).toISOString().slice(0, 16); } catch { return ""; }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-border bg-secondary/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Pricing tiers (early bird → regular)
          </span>
          <p className="text-[11px] text-ink-soft">
            Tiers apply in order. The first tier not yet expired is charged; leave the last tier's expiry blank so it always applies. If empty, the class price is used.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md bg-card px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-border"
        >
          <Plus className="h-3.5 w-3.5" /> Add tier
        </button>
      </div>
      <ul className="space-y-2">
        {prices.map((p, i) => (
          <li key={p.id} className="rounded-lg border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                Tier {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 text-ink-soft hover:bg-secondary disabled:opacity-30"
                  aria-label="Move up"
                >
                  <GripVertical className="h-3 w-3 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === prices.length - 1}
                  className="rounded p-0.5 text-ink-soft hover:bg-secondary disabled:opacity-30"
                  aria-label="Move down"
                >
                  <GripVertical className="h-3 w-3 -rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => rm(i)}
                  className="rounded p-0.5 text-cherry hover:bg-accent"
                  aria-label="Remove tier"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <input
                className={inputCls}
                placeholder="Label (e.g. Early Bird)"
                value={p.label}
                onChange={(e) => upd(i, { label: e.target.value })}
              />
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="Price ZAR"
                value={p.priceZAR}
                onChange={(e) => upd(i, { priceZAR: Number(e.target.value) })}
              />
              <input
                type="datetime-local"
                className={inputCls}
                value={toLocal(p.expiresAt)}
                onChange={(e) =>
                  upd(i, {
                    expiresAt: e.target.value ? new Date(e.target.value).toISOString() : "",
                  })
                }
              />
            </div>
            {!p.expiresAt ? (
              <p className="mt-1 text-[10px] text-ink-soft">No expiry — this tier always applies unless an earlier tier is active.</p>
            ) : null}
          </li>
        ))}
        {prices.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border bg-background p-3 text-center text-[11px] text-ink-soft">
            No tiered pricing. Riders pay the class price.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

const ROUTE_TIERS: RouteTier[] = ["Gold", "Silver", "Bronze", "Custom"];

function DaysEditor({
  days,
  onChange,
}: {
  days: EventDay[];
  onChange: (next: EventDay[]) => void;
}) {
  const addDay = () =>
    onChange([
      ...days,
      {
        id: newId("day"),
        date: new Date(Date.now() + (days.length + 1) * 86400000).toISOString().slice(0, 10),
        label: `Day ${days.length + 1}`,
        routes: [],
      },
    ]);
  const updateDay = (i: number, patch: Partial<EventDay>) =>
    onChange(days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const removeDay = (i: number) => onChange(days.filter((_, idx) => idx !== i));
  const moveDay = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= days.length) return;
    const next = [...days];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const addRoute = (dayIdx: number, tier: RouteTier = "Gold") => {
    const next = [...days];
    next[dayIdx] = {
      ...next[dayIdx],
      routes: [
        ...next[dayIdx].routes,
        {
          id: newId("rt"),
          tier,
          name: `${tier} route`,
          distanceKm: 0,
        },
      ],
    };
    onChange(next);
  };
  const updateRoute = (dayIdx: number, rIdx: number, patch: Partial<EventRoute>) => {
    const next = [...days];
    const routes = [...next[dayIdx].routes];
    routes[rIdx] = { ...routes[rIdx], ...patch };
    next[dayIdx] = { ...next[dayIdx], routes };
    onChange(next);
  };
  const removeRoute = (dayIdx: number, rIdx: number) => {
    const next = [...days];
    next[dayIdx] = {
      ...next[dayIdx],
      routes: next[dayIdx].routes.filter((_, i) => i !== rIdx),
    };
    onChange(next);
  };

  return (
    <div className="md:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Days & routes
          </span>
          <p className="text-[11px] text-ink-soft">
            Multi-day events. Add each day, then add Gold / Silver / Bronze route options riders can choose from.
          </p>
        </div>
        <button
          type="button"
          onClick={addDay}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-ink"
        >
          <Plus className="h-3.5 w-3.5" /> Add day
        </button>
      </div>

      <ul className="space-y-3">
        {days.map((d, i) => (
          <li key={d.id} className="rounded-xl border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                Day {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveDay(i, -1)}
                  disabled={i === 0}
                  className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                  aria-label="Move up"
                >
                  <GripVertical className="h-3 w-3 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDay(i, 1)}
                  disabled={i === days.length - 1}
                  className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                  aria-label="Move down"
                >
                  <GripVertical className="h-3 w-3 -rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => removeDay(i)}
                  className="rounded-md p-1 text-cherry hover:bg-accent"
                  aria-label="Remove day"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="date"
                className={inputCls}
                value={d.date?.slice(0, 10) ?? ""}
                onChange={(e) => updateDay(i, { date: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="Label (e.g. Day 1 — Prologue)"
                value={d.label ?? ""}
                onChange={(e) => updateDay(i, { label: e.target.value })}
              />
            </div>

            <div className="mt-3 rounded-lg bg-card p-3 ring-1 ring-border">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                  Routes on this day
                </span>
                <div className="flex flex-wrap gap-1">
                  {ROUTE_TIERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addRoute(i, t)}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-ink hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" /> {t}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-2">
                {d.routes.map((r, rIdx) => (
                  <li key={r.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          r.tier === "Gold"
                            ? "bg-amber-100 text-amber-800"
                            : r.tier === "Silver"
                              ? "bg-slate-200 text-slate-800"
                              : r.tier === "Bronze"
                                ? "bg-orange-100 text-orange-900"
                                : "bg-secondary text-ink-soft"
                        }`}
                      >
                        {r.tier}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRoute(i, rIdx)}
                        className="rounded-md p-1 text-cherry hover:bg-accent"
                        aria-label="Remove route"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <select
                        className={inputCls}
                        value={r.tier}
                        onChange={(e) =>
                          updateRoute(i, rIdx, { tier: e.target.value as RouteTier })
                        }
                      >
                        {ROUTE_TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        className={inputCls}
                        placeholder="Route name (e.g. Gold — 120km Queen Stage)"
                        value={r.name}
                        onChange={(e) => updateRoute(i, rIdx, { name: e.target.value })}
                      />
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="Distance km"
                        value={r.distanceKm}
                        onChange={(e) =>
                          updateRoute(i, rIdx, { distanceKm: Number(e.target.value) })
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="Elevation m (opt)"
                        value={r.elevationM ?? ""}
                        onChange={(e) =>
                          updateRoute(i, rIdx, {
                            elevationM: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                      <input
                        className={`${inputCls} sm:col-span-2`}
                        placeholder="GPX download URL (optional)"
                        value={r.gpxUrl ?? ""}
                        onChange={(e) =>
                          updateRoute(i, rIdx, { gpxUrl: e.target.value || undefined })
                        }
                      />
                      <textarea
                        className={`${inputCls} sm:col-span-2 min-h-20`}
                        placeholder="Route description — climbs, surface, cut-offs, notes for riders…"
                        value={r.description ?? ""}
                        onChange={(e) =>
                          updateRoute(i, rIdx, { description: e.target.value || undefined })
                        }
                      />
                      <div className="sm:col-span-2">
                        <KmlManager
                          urls={r.kmlUrls ?? []}
                          onChange={(urls) => updateRoute(i, rIdx, { kmlUrls: urls })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <CustomMarkerEditor
                          markers={r.customMarkers ?? []}
                          onChange={(markers) => updateRoute(i, rIdx, { customMarkers: markers })}
                        />
                      </div>
                    </div>
                  </li>
                ))}
                {d.routes.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-ink-soft">
                    No routes yet. Add Gold, Silver or Bronze options above.
                  </li>
                ) : null}
              </ul>
            </div>
          </li>
        ))}
        {days.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-ink-soft">
            Single-day event. Add days here if the event spans multiple days with different routes.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
