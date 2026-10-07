// Super-admin editor: tap to add marshal spots / route points, drag waterpoints to move them.
import { createFileRoute, ClientOnly, Link, notFound } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Droplets, Loader2, MapPin, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseKml, type LatLngAlt } from "@/lib/geo";
import { distanceToRouteM } from "@/lib/tracking-route-overlay";
import type { CustomMarker, EventDay } from "@/lib/mock-data";
import type { EditorLine, EditorPoint } from "@/components/route-points-editor-map";

const EditorMap = lazy(() => import("@/components/route-points-editor-map"));

export const Route = createFileRoute("/admin/route-points/$eventId")({
  head: () => ({ meta: [{ title: "Edit route points · Admin" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ params }) => {
    const { data, error } = await supabase.from("events").select("id, name, days").eq("id", params.eventId).maybeSingle();
    if (error || !data) throw notFound();
    return { event: data as { id: string; name: string; days: EventDay[] | null } };
  },
  component: RoutePointsEditor,
  notFoundComponent: () => <p className="p-6 text-sm">Event not found.</p>,
  errorComponent: ({ error }) => <p className="p-6 text-sm">Could not load: {error.message}</p>,
});

type Group = {
  gid: string;
  name: string;
  icon: NonNullable<CustomMarker["icon"]>;
  lat: number;
  lng: number;
  description?: string;
  color?: string;
  logoUrl?: string;
  /** routeId -> marker id on that route */
  routes: Record<string, string>;
};

const TYPES: { icon: Group["icon"]; label: string; defaultName: string }[] = [
  { icon: "warning", label: "Marshal", defaultName: "Marshal" },
  { icon: "water", label: "Waterpoint", defaultName: "Waterpoint" },
  { icon: "pin", label: "Route point", defaultName: "Point" },
  { icon: "aid", label: "Medic / aid", defaultName: "Medic" },
];

const ROUTE_COLORS: Record<string, string> = { Gold: "#d4a017", Silver: "#64748b", Bronze: "#b45309" };

function groupsFromDay(day: EventDay): Group[] {
  const byKey = new Map<string, Group>();
  for (const r of day.routes ?? []) {
    for (const m of r.customMarkers ?? []) {
      const key = `${m.name}|${m.lat.toFixed(5)}|${m.lng.toFixed(5)}|${m.icon ?? "pin"}`;
      const g = byKey.get(key);
      if (g) g.routes[r.id] = m.id;
      else
        byKey.set(key, {
          gid: crypto.randomUUID(),
          name: m.name,
          icon: m.icon ?? "pin",
          lat: m.lat,
          lng: m.lng,
          description: m.description,
          color: m.color,
          logoUrl: m.logoUrl,
          routes: { [r.id]: m.id },
        });
    }
  }
  return [...byKey.values()];
}

function RoutePointsEditor() {
  const { event } = Route.useLoaderData();
  const days = useMemo(() => (Array.isArray(event.days) ? event.days : []), [event.days]);
  const [dayIdx, setDayIdx] = useState(0);
  const [groups, setGroups] = useState<Record<string, Group[]>>(() =>
    Object.fromEntries(days.map((d) => [d.id, groupsFromDay(d)])),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Group["icon"] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<EditorLine[]>([]);
  const day = days[dayIdx];
  const dayGroups = day ? groups[day.id] ?? [] : [];
  const sel = dayGroups.find((g) => g.gid === selected) ?? null;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Load the day's route lines.
  useEffect(() => {
    let off = false;
    setLines([]);
    if (!day) return;
    (async () => {
      const out: EditorLine[] = [];
      for (const r of day.routes ?? []) {
        const ls: LatLngAlt[][] = [];
        for (const url of r.kmlUrls ?? []) {
          try {
            const res = await fetch(url);
            if (res.ok) ls.push(...parseKml(await res.text()).lines);
          } catch {
            /* skip unreadable file */
          }
        }
        out.push({ routeId: r.id, color: r.color || ROUTE_COLORS[r.tier] || "#e11d48", lines: ls });
      }
      if (!off) setLines(out);
    })();
    return () => {
      off = true;
    };
  }, [day]);

  function patchDay(fn: (gs: Group[]) => Group[]) {
    if (!day) return;
    setGroups((all) => ({ ...all, [day.id]: fn(all[day.id] ?? []) }));
    setDirty(true);
  }
  const update = (gid: string, patch: Partial<Group>) =>
    patchDay((gs) => gs.map((g) => (g.gid === gid ? { ...g, ...patch } : g)));

  function place(lat: number, lng: number) {
    if (!day || !placing) return;
    const t = TYPES.find((x) => x.icon === placing)!;
    const near = lines.filter((l) => l.lines.length && distanceToRouteM(l.lines, lat, lng) < 150).map((l) => l.routeId);
    const routeIds = near.length ? near : (day.routes ?? []).map((r) => r.id);
    const g: Group = {
      gid: crypto.randomUUID(),
      name: t.defaultName,
      icon: placing,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      routes: Object.fromEntries(routeIds.map((id) => [id, crypto.randomUUID()])),
    };
    patchDay((gs) => [...gs, g]);
    setSelected(g.gid);
    setPlacing(null);
  }

  async function save() {
    setSaving(true);
    const nextDays = days.map((d) => {
      const gs = groups[d.id] ?? [];
      return {
        ...d,
        routes: (d.routes ?? []).map((r) => ({
          ...r,
          customMarkers: gs
            .filter((g) => g.routes[r.id])
            .map((g) => {
              const m: CustomMarker = { id: g.routes[r.id]!, name: g.name.trim() || "Point", lat: g.lat, lng: g.lng, icon: g.icon };
              if (g.description) m.description = g.description;
              if (g.color) m.color = g.color;
              if (g.logoUrl) m.logoUrl = g.logoUrl;
              return m;
            }),
        })),
      };
    });
    const { error } = await supabase.from("events").update({ days: nextDays as never }).eq("id", event.id);
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    setDirty(false);
    toast.success("Route points saved — riders and crew see them straight away.");
  }

  const points: EditorPoint[] = dayGroups.map((g) => ({ key: g.gid, name: g.name, icon: g.icon, lat: g.lat, lng: g.lng }));
  const counts = { marshal: dayGroups.filter((g) => g.icon === "warning").length, water: dayGroups.filter((g) => g.icon === "water").length };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/admin/route-points" className="grid h-9 w-9 place-items-center rounded-full bg-card ring-1 ring-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Route points</p>
          <h1 className="truncate font-display text-xl font-bold text-ink">{event.name}</h1>
        </div>
        <button
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-lg cherry-gradient px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      {days.length === 0 ? (
        <p className="rounded-xl bg-card p-4 text-sm text-ink-soft ring-1 ring-border">This event has no days or routes yet. Add them on the Events page first.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {days.map((d, i) => (
              <button
                key={d.id}
                onClick={() => {
                  setDayIdx(i);
                  setSelected(null);
                  setPlacing(null);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-border ${i === dayIdx ? "bg-ink text-primary-foreground" : "bg-card text-ink"}`}
              >
                {d.label || `Day ${i + 1}`} · {(d.routes ?? []).length} routes
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-2 ring-1 ring-border">
            <span className="px-1 text-xs font-semibold text-ink-soft">Add:</span>
            {TYPES.map((t) => (
              <button
                key={t.icon}
                onClick={() => setPlacing(placing === t.icon ? null : t.icon)}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-border ${placing === t.icon ? "bg-cherry text-primary-foreground" : "bg-background text-ink"}`}
              >
                {t.icon === "water" ? <Droplets className="h-3.5 w-3.5" /> : t.icon === "warning" ? <ShieldAlert className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                {t.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-ink-soft">
              {counts.marshal} marshals · {counts.water} waterpoints
            </span>
          </div>
          <p className="text-xs text-ink-soft">
            {placing
              ? "Now tap the map where it should go."
              : "Drag any point to move it. Tap a point to rename it, change its routes or delete it."}
          </p>

          <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
            <div className="h-[65vh] overflow-hidden rounded-xl ring-1 ring-border">
              <ClientOnly fallback={<div className="grid h-full place-items-center text-sm text-ink-soft">Loading map…</div>}>
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-ink-soft">Loading map…</div>}>
                  <EditorMap
                    lines={lines}
                    points={points}
                    selectedKey={selected}
                    placing={!!placing}
                    onSelect={setSelected}
                    onMove={(gid, lat, lng) => update(gid, { lat: +lat.toFixed(6), lng: +lng.toFixed(6) })}
                    onPlace={place}
                  />
                </Suspense>
              </ClientOnly>
            </div>

            <aside className="rounded-xl bg-card p-3 ring-1 ring-border">
              {!sel ? (
                <p className="text-sm text-ink-soft">Tap a point on the map to edit it.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Edit point</p>
                    <button onClick={() => setSelected(null)} aria-label="Close" className="text-ink-soft">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="block text-xs font-semibold text-ink">
                    Name
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      value={sel.name}
                      onChange={(e) => update(sel.gid, { name: e.target.value })}
                    />
                  </label>
                  <div>
                    <p className="text-xs font-semibold text-ink">Type</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {TYPES.map((t) => (
                        <button
                          key={t.icon}
                          onClick={() => update(sel.gid, { icon: t.icon })}
                          className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ring-border ${sel.icon === t.icon ? "bg-ink text-primary-foreground" : "bg-background"}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink">Show on routes</p>
                    <div className="mt-1 space-y-1">
                      {(day?.routes ?? []).map((r) => (
                        <label key={r.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!sel.routes[r.id]}
                            onChange={(e) => {
                              const routes = { ...sel.routes };
                              if (e.target.checked) routes[r.id] = crypto.randomUUID();
                              else delete routes[r.id];
                              update(sel.gid, { routes });
                            }}
                          />
                          {r.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-soft">
                    {sel.lat.toFixed(5)}, {sel.lng.toFixed(5)} — drag the pin to move it.
                  </p>
                  <button
                    onClick={() => {
                      patchDay((gs) => gs.filter((g) => g.gid !== sel.gid));
                      setSelected(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete point
                  </button>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
