import { createFileRoute, ClientOnly, Link, notFound, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, PencilRuler, Save, Sparkles, Square, Tent, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BUILD_CATEGORIES,
  VILLAGE_CATEGORIES,
  VILLAGE_LAYERS,
  buildTemplateSpots,
  categoryMeta,
  spotColor,
  spotIcon,
  emptyVillageMap,
  fetchVillageMap,
  hasVenueCentre,
  parseLatLngFromUrl,
  saveVillageMap,
  templateSpots,
  spotLayer,
  type VillageCategory,
  type VillageHotspot,
  type VillageLayer,
  type VillageGeo,
  type VillageMap,
} from "@/lib/village-map";

import { VILLAGE_COLORS, VILLAGE_ICONS, guessVillageIcon, villageIcon } from "@/lib/village-icons";
import {
  ZONE_COLORS,
  formatArea,
  formatLength,
  overlappingZoneIds,
  rectangleZone,
  resizeZone,
  zoneAreaM2,
  zoneColor,
  zonePerimeterM,
  zoneSizeM,
  nextZoneName,
  pointInZone,
  translateZone,
  zoneSizeM as zoneSizeMetres,
  type VillageZone,
  type ZonePoint,
} from "@/lib/village-zones";
import ZoneDuplicator from "@/components/zone-duplicator";
import { fetchVillageTents } from "@/lib/village-tents";

const VillageMapEditorGeo = lazy(() => import("@/components/village-map-editor-geo"));

export const Route = createFileRoute("/admin/village/$eventId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, location")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    const { data: info } = await supabase
      .from("event_info_blocks")
      .select("venue_lat, venue_lng, venue_address")
      .eq("event_id", params.eventId)
      .maybeSingle();
    const { data: venues } = await supabase
      .from("event_venues")
      .select("id, name, address, sort_order")
      .eq("event_id", params.eventId)
      .order("sort_order", { ascending: true });
    return { event: data, info: info ?? null, venues: venues ?? [] };
  },
  component: VillageEditor,
});


async function uploadVillageImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `village/${crypto.randomUUID()}.${ext}`;
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

function VillageEditor() {
  const { event, info, venues } = Route.useLoaderData();
  const router = useRouter();
  // Multi-venue events (PE PLETT) get one village per venue. Events with no
  // venues keep the single "main village" (venue_id null).
  const [venueId, setVenueId] = useState<string | null>(venues[0]?.id ?? null);
  const activeVenue = venues.find((v) => v.id === venueId) ?? null;
  const q = useQuery({
    queryKey: ["village-map", event.id, venueId],
    queryFn: () => fetchVillageMap(event.id, venueId),
  });
  const [map, setMap] = useState<VillageMap>(() => emptyVillageMap(event.id, venues[0]?.id ?? null));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [placing, setPlacing] = useState(false);
  // Which layer we are working on: new points land here and only this layer
  // (plus rider points as context) is shown on the editor map.
  const [layer, setLayer] = useState<VillageLayer>("rider");
  const [selected, setSelected] = useState<string | null>(null);
  const [centreToken, setCentreToken] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [tentMode, setTentMode] = useState(false);
  const [selectedTent, setSelectedTent] = useState<string | null>(null);
  const [nextTentLabel, setNextTentLabel] = useState("1");
  // 'tent' drops a real tent number (shown to riders); 'marker' drops a helper
  // point used only for drawing areas — never rendered on rider-facing maps.
  const [tentKind, setTentKind] = useState<"tent" | "marker">("tent");
  const qc = useQueryClient();
  const tentsQ = useQuery({
    queryKey: ["village-tents", event.id, venueId],
    queryFn: () => fetchVillageTents(event.id, venueId),
  });
  const tents = tentsQ.data ?? [];

  // Switching village: clear the editor immediately so nothing from the previous
  // village can be saved onto the new one.
  useEffect(() => {
    setMap(emptyVillageMap(event.id, venueId));
    setSelected(null);
    setSelectedZone(null);
    setSelectedTent(null);
  }, [venueId, event.id]);


  function bumpLabel(label: string) {
    const n = Number(label.match(/\d+$/)?.[0] ?? NaN);
    if (!Number.isFinite(n)) return label;
    return label.replace(/\d+$/, String(n + 1));
  }

  async function placeTent(lat: number, lng: number) {
    const label = nextTentLabel.trim() || String(tents.length + 1);
    const zone = zones.find((z) => pointInZone({ lat, lng }, z)) ?? null;
    const { error } = await supabase
      .from("event_village_tents")
      .insert({ event_id: event.id, venue_id: venueId, label, lat, lng, zone_id: zone?.id ?? null, kind: tentKind });
    if (error) {
      alert(error.message);
      return;
    }
    if (tentKind === "tent") setNextTentLabel(bumpLabel(label));
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }

  async function moveTent(id: string, lat: number, lng: number) {
    const zone = zones.find((z) => pointInZone({ lat, lng }, z)) ?? null;
    await supabase.from("event_village_tents").update({ lat, lng, zone_id: zone?.id ?? null }).eq("id", id);
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }

  async function toggleTentKind(id: string) {
    const tent = tents.find((t) => t.id === id);
    if (!tent) return;
    await supabase
      .from("event_village_tents")
      .update({ kind: tent.kind === "marker" ? "tent" : "marker" })
      .eq("id", id);
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }

  async function deleteTent(id: string) {
    await supabase.from("event_village_tents").delete().eq("id", id);
    setSelectedTent(null);
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<string | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.data) return;
    const loaded = { ...q.data, venue_id: venueId };
    if (!hasVenueCentre(loaded.geo) && info?.venue_lat && info?.venue_lng) {
      setMap({ ...loaded, geo: { lat: info.venue_lat, lng: info.venue_lng, widthM: 0 } });
    } else {
      setMap(loaded);
    }
  }, [q.data, venueId, info?.venue_lat, info?.venue_lng]);


  const usingImage = !!map.image_url;
  const centre = useMemo(
    () => (hasVenueCentre(map.geo) ? { lat: map.geo.lat, lng: map.geo.lng } : null),
    [map.geo],
  );
  const zones = map.zones ?? [];
  const overlapping = useMemo(() => overlappingZoneIds(zones), [zones]);
  const activeZone = useMemo(() => zones.find((z) => z.id === selectedZone) ?? null, [zones, selectedZone]);
  const selectedSpot = useMemo(
    () => map.hotspots.find((s) => s.id === selected) ?? null,
    [map.hotspots, selected],
  );

  function patch(next: Partial<VillageMap>) {
    setMap((prev) => ({ ...prev, ...next }));
    setSaved(false);
  }

  function patchGeo(next: Partial<VillageGeo>) {
    const base: VillageGeo = map.geo ?? { lat: 0, lng: 0, widthM: 0, rotation: 0 };
    patch({ geo: { ...base, ...next } });
  }

  function updateSpot(id: string, next: Partial<VillageHotspot>) {
    patch({ hotspots: map.hotspots.map((s) => (s.id === id ? { ...s, ...next } : s)) });
  }

  function updateZone(id: string, next: Partial<VillageZone>) {
    patch({ zones: zones.map((z) => (z.id === id ? { ...z, ...next } : z)) });
  }

  function duplicateZone(id: string) {
    const z = zones.find((o) => o.id === id);
    if (!z) return;
    const copy = translateZone(z, zoneSizeMetres(z).w + 2, 0);
    copy.id = crypto.randomUUID();
    copy.name = nextZoneName(z.name, zones.map((o) => o.name));
    patch({ zones: [...zones, copy] });
    setSelectedZone(copy.id);
  }

  function addDrawnZone(points: ZonePoint[]) {
    const zone: VillageZone = {
      id: crypto.randomUUID(),
      name: `Area ${zones.length + 1}`,
      color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
      points,
    };
    patch({ zones: [...zones, zone] });
    setSelectedZone(zone.id);
    setDrawing(false);
  }

  function addRectangle() {
    if (!centre) return;
    const w = Number(window.prompt("Width in metres (east–west)", "20"));
    const h = Number(window.prompt("Length in metres (north–south)", "10"));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    const zone = rectangleZone(centre, w, h, `Area ${zones.length + 1}`);
    zone.color = ZONE_COLORS[zones.length % ZONE_COLORS.length];
    patch({ zones: [...zones, zone] });
    setSelectedZone(zone.id);
  }

  function pasteVenueLink() {
    const url = window.prompt(
      "Paste a Google Maps link for the venue (or type lat,lng e.g. -34.0640, 18.8925)",
    );
    if (!url) return;
    const c = parseLatLngFromUrl(url.trim());
    if (!c) {
      alert("Couldn't read coordinates from that. Right-click the venue in Google Maps and copy the numbers.");
      return;
    }
    patchGeo(c);
    setCentreToken((t) => t + 1);
  }

  function loadMasterLayout() {
    if (!centre) {
      alert("Set the venue location first, then load the master layout.");
      return;
    }
    if (map.hotspots.length > 0 && !window.confirm("Add the master Weekend Warrior layout on top of the existing points?")) {
      return;
    }
    patch({ hotspots: [...map.hotspots, ...templateSpots(centre)] });
    setCentreToken((t) => t + 1);
  }

  function placeSpot(lat: number, lng: number) {
    const spot: VillageHotspot = {
      id: crypto.randomUUID(),
      x: 50,
      y: 50,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      title: "New point",
      category: BUILD_CATEGORIES[layer][0] ?? "other",
      layer,
    };
    patch({ hotspots: [...map.hotspots, spot] });
    setSelected(spot.id);
    setPlacing(false);
  }

  function loadBuildKit() {
    if (!centre) {
      alert("Set the venue location first, then load the build kit.");
      return;
    }
    patch({ hotspots: [...map.hotspots, ...buildTemplateSpots(centre, layer)] });
    setCentreToken((t) => t + 1);
  }

  // ---- image-mode helpers (kept for events that still use a plan image) ----
  function coordsFromEvent(e: React.MouseEvent) {
    const el = imgWrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(100, Math.max(0, +x.toFixed(2))), y: Math.min(100, Math.max(0, +y.toFixed(2))) };
  }

  function handleImageClick(e: React.MouseEvent) {
    if (!placing) return;
    const c = coordsFromEvent(e);
    if (!c) return;
    const spot: VillageHotspot = {
      id: crypto.randomUUID(),
      x: c.x,
      y: c.y,
      title: "New point",
      category: BUILD_CATEGORIES[layer][0] ?? "other",
      layer,
    };
    patch({ hotspots: [...map.hotspots, spot] });
    setSelected(spot.id);
    setPlacing(false);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return;
    const c = coordsFromEvent(e);
    if (!c) return;
    updateSpot(dragRef.current, c);
  }

  async function onFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadVillageImage(file);
      patch({ image_url: url });
    } catch (err) {
      console.warn("[village:upload]", err);
      alert("Upload failed. Please try a smaller image.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    const ok = await saveVillageMap(map);
    setSaving(false);
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 2000);
  }

  async function addVenue() {
    const name = window.prompt("Venue name (e.g. St Francis Links)");
    if (!name?.trim()) return;
    const { data, error } = await supabase
      .from("event_venues")
      .insert({ event_id: event.id, name: name.trim(), sort_order: venues.length })
      .select("id")
      .maybeSingle();
    if (error || !data) {
      alert(error?.message ?? "Could not add that venue.");
      return;
    }
    await router.invalidate();
    setVenueId(data.id);
  }


  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <Link to="/admin/events" className="grid h-9 w-9 place-items-center rounded-full bg-card ring-1 ring-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
            Village map · {event.name}
          </p>
          <h1 className="font-display text-xl font-bold text-ink">Interactive village map</h1>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg cherry-gradient px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>

      {/* One village per venue — multi-day events can run several race villages. */}
      <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Which village are you building?
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {venues.length === 0 ? (
            <span className="rounded-full bg-cherry px-3 py-1.5 text-xs font-bold text-white">Main village</span>
          ) : null}
          {venues.map((v) => (
            <button
              key={v.id}
              onClick={() => setVenueId(v.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                venueId === v.id ? "bg-cherry text-white" : "bg-muted text-ink"
              }`}
            >
              {v.name}
            </button>
          ))}
          <button
            onClick={() => void addVenue()}
            className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-ink-soft"
          >
            + Add venue
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">
          {activeVenue
            ? `Points, areas, tents and rooming lists below belong to ${activeVenue.name} only.`
            : "This event has one race village. Add a venue to run separate villages per day."}
        </p>
      </div>


      <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <label className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Intro text (shown above the map)
        </label>
        <textarea
          value={map.intro ?? ""}
          onChange={(e) => patch({ intro: e.target.value || null })}
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Everything you need at race village — registration, food, camping and more."
        />
      </div>

      {/* Venue location — the anchor for pin-on-map mode */}
      <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Venue location {event.location ? `· ${event.location}` : ""}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-semibold text-ink-soft">
            Latitude
            <input
              type="number"
              step="0.00001"
              value={map.geo?.lat ?? ""}
              onChange={(e) => patchGeo({ lat: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="-34.06400"
            />
          </label>
          <label className="text-xs font-semibold text-ink-soft">
            Longitude
            <input
              type="number"
              step="0.00001"
              value={map.geo?.lng ?? ""}
              onChange={(e) => patchGeo({ lng: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="18.89250"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={pasteVenueLink}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-bold text-ink"
            >
              <MapPin className="h-3.5 w-3.5" /> Paste Google Maps link
            </button>
          </div>
        </div>
        {info?.venue_lat && info?.venue_lng ? (
          <button
            onClick={() => {
              patchGeo({ lat: info.venue_lat as number, lng: info.venue_lng as number });
              setCentreToken((t) => t + 1);
            }}
            className="mt-2 text-[11px] font-bold text-cherry underline"
          >
            Use the venue saved on this event ({info.venue_address ?? `${info.venue_lat}, ${info.venue_lng}`})
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlacing((p) => !p)}
          disabled={!usingImage && !centre}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
            placing ? "bg-cherry text-white" : "bg-muted text-ink"
          }`}
        >
          {placing ? "Click the map to place…" : "Add point"}
        </button>
        <button
          onClick={() => {
            setDrawing((d) => !d);
            setPlacing(false);
          }}
          disabled={usingImage || !centre}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
            drawing ? "bg-cherry text-white" : "bg-muted text-ink"
          }`}
        >
          <PencilRuler className="h-3.5 w-3.5" /> {drawing ? "Drawing area…" : "Draw area"}
        </button>
        <button
          onClick={() => {
            setTentMode((t) => !t);
            setPlacing(false);
            setDrawing(false);
          }}
          disabled={usingImage || !centre}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
            tentMode ? "bg-cherry text-white" : "bg-muted text-ink"
          }`}
        >
          <Tent className="h-3.5 w-3.5" /> {tentMode ? "Click to drop tents…" : "Add tent pins"}
        </button>
        {tentMode ? (
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-border">
            {(["tent", "marker"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTentKind(k)}
                className={`px-2.5 py-1.5 text-[11px] font-bold ${
                  tentKind === k ? "bg-cherry text-white" : "bg-muted text-ink-soft"
                }`}
              >
                {k === "tent" ? "Tent number" : "Area marker"}
              </button>
            ))}
          </div>
        ) : null}
        {tentMode ? (
          <label className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-[11px] font-bold text-ink-soft">
            {tentKind === "tent" ? "Next tent" : "Marker label"}
            <input
              value={nextTentLabel}
              onChange={(e) => setNextTentLabel(e.target.value)}
              className="w-20 rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-ink"
            />
          </label>
        ) : null}
        {selectedTent ? (
          <button
            onClick={() => void deleteTent(selectedTent)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete tent pin
          </button>
        ) : null}
        <button
          onClick={addRectangle}
          disabled={usingImage || !centre}
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5" /> Add area by size
        </button>
        <button
          onClick={loadMasterLayout}
          disabled={usingImage || !centre}
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> Load master layout
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {usingImage ? "Replace plan image" : "Use a plan image instead"}
        </button>
        {usingImage ? (
          <button
            onClick={() => patch({ image_url: null })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove image
          </button>
        ) : null}
      </div>

      <div className="relative">
      {usingImage ? (
        <>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              Plan image placement
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ink-soft">
                Width on the ground (m)
                <input
                  type="number"
                  step="10"
                  value={map.geo?.widthM ?? ""}
                  onChange={(e) => patchGeo({ widthM: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="520"
                />
              </label>
              <label className="text-xs font-semibold text-ink-soft">
                Rotation (°)
                <input
                  type="number"
                  step="1"
                  value={map.geo?.rotation ?? 0}
                  onChange={(e) => patchGeo({ rotation: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="0"
                />
              </label>
            </div>
          </div>

          <div
            ref={imgWrapRef}
            onClick={handleImageClick}
            onMouseMove={handleMouseMove}
            onMouseUp={() => (dragRef.current = null)}
            onMouseLeave={() => (dragRef.current = null)}
            className={`relative overflow-hidden rounded-2xl ring-1 ring-border ${placing ? "cursor-crosshair" : ""}`}
          >
            <img src={map.image_url!} alt="Village map" className="block w-full select-none" draggable={false} />
            {map.hotspots.map((s) => {
              const PinIcon = villageIcon(spotIcon(s)).Comp;
              return (
                <button
                  key={s.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    dragRef.current = s.id;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(s.id);
                  }}
                  style={{ left: `${s.x}%`, top: `${s.y}%`, backgroundColor: spotColor(s) }}
                  className={`absolute inline-flex -translate-x-1/2 -translate-y-1/2 cursor-move items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-white shadow ${
                    selected === s.id ? "ring-2 ring-cherry" : ""
                  }`}
                >
                  <PinIcon className="h-3 w-3" />
                  {s.title}
                </button>
              );
            })}
          </div>
        </>
      ) : centre ? (
        <ClientOnly fallback={<div className="h-[65vh] min-h-[360px] animate-pulse rounded-2xl bg-muted" />}>
          <Suspense fallback={<div className="h-[65vh] min-h-[360px] animate-pulse rounded-2xl bg-muted" />}>
            <VillageMapEditorGeo
              centre={centre}
              centreToken={centreToken}
              hotspots={map.hotspots}
              selected={selected}
              placing={placing}
              drawing={drawing}
              zones={zones}
              selectedZone={selectedZone}
              overlapping={overlapping}
              onPlace={placeSpot}
              onMove={(id, lat, lng) => updateSpot(id, { lat, lng })}
              onSelect={setSelected}
              onDrawn={addDrawnZone}
              onCancelDraw={() => setDrawing(false)}
              onCancelPlace={() => setPlacing(false)}
              onZoneChange={(id, points) => updateZone(id, { points })}
              onSelectZone={setSelectedZone}
              onRenameZone={(id, name) => updateZone(id, { name })}
              onDuplicateZone={duplicateZone}
              tents={tents.map((t) => ({ id: t.id, label: t.label, lat: t.lat, lng: t.lng, kind: t.kind }))}
              tentMode={tentMode}
              onPlaceTent={placeTent}
              onMoveTent={moveTent}
              onSelectTent={setSelectedTent}
              selectedTent={selectedTent}
              onDeleteTent={(id) => void deleteTent(id)}
              onToggleTentKind={(id) => void toggleTentKind(id)}
              onDeleteHotspot={(id) => {
                patch({ hotspots: map.hotspots.filter((h) => h.id !== id) });
                if (selected === id) setSelected(null);
              }}
            />
          </Suspense>
        </ClientOnly>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-soft">
          Set the venue location above (paste a Google Maps link) to start dropping points on the satellite map.
        </div>
      )}

      {selectedSpot ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3">
          <div className="pointer-events-auto rounded-2xl bg-card/95 p-3 shadow-lg ring-1 ring-border backdrop-blur">
            <div className="flex items-center gap-2">
              <input
                value={selectedSpot.title}
                onChange={(e) => updateSpot(selectedSpot.id, { title: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"
                placeholder="Point name"
              />
              <button
                onClick={() => {
                  patch({ hotspots: map.hotspots.filter((h) => h.id !== selectedSpot.id) });
                  setSelected(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-lg bg-muted"
                aria-label="Delete point"
              >
                <Trash2 className="h-4 w-4 text-ink-soft" />
              </button>
              <button
                onClick={() => setSelected(null)}
                className="grid h-9 w-9 place-items-center rounded-lg bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-ink-soft" />
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select
                value={selectedSpot.category}
                onChange={(e) => updateSpot(selectedSpot.id, { category: e.target.value as VillageCategory })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {VILLAGE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={selectedSpot.hours ?? ""}
                onChange={(e) => updateSpot(selectedSpot.id, { hours: e.target.value || undefined })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Open hours e.g. 07:00 – 18:00"
              />
            </div>
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                  Icon
                  {selectedSpot.icon ? (
                    <button
                      onClick={() => updateSpot(selectedSpot.id, { icon: undefined })}
                      className="ml-2 text-cherry underline"
                    >
                      auto from name ({villageIcon(guessVillageIcon(selectedSpot.title, selectedSpot.category)).label})
                    </button>
                  ) : (
                    <span className="ml-2 font-semibold normal-case tracking-normal">auto from name</span>
                  )}
                </p>
                <div className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                  {VILLAGE_ICONS.map((ic) => {
                    const Ico = ic.Comp;
                    const on = spotIcon(selectedSpot) === ic.id;
                    return (
                      <button
                        key={ic.id}
                        title={ic.label}
                        onClick={() => updateSpot(selectedSpot.id, { icon: ic.id })}
                        className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ${
                          on ? "ring-2 ring-cherry" : "ring-border"
                        }`}
                        style={on ? { backgroundColor: spotColor(selectedSpot), color: "#fff" } : undefined}
                      >
                        <Ico className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                  Colour
                  {selectedSpot.color ? (
                    <button
                      onClick={() => updateSpot(selectedSpot.id, { color: undefined })}
                      className="ml-2 text-cherry underline"
                    >
                      use category colour
                    </button>
                  ) : (
                    <span className="ml-2 font-semibold normal-case tracking-normal">
                      from category ({categoryMeta(selectedSpot.category).label})
                    </span>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {VILLAGE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateSpot(selectedSpot.id, { color: c })}
                      className={`h-6 w-6 rounded-full ring-1 ring-border ${
                        spotColor(selectedSpot) === c ? "ring-2 ring-offset-2 ring-cherry" : ""
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Colour ${c}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={spotColor(selectedSpot)}
                    onChange={(e) => updateSpot(selectedSpot.id, { color: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border border-border bg-background"
                    aria-label="Custom colour"
                  />
                </div>
              </div>
            </div>
            <textarea
              value={selectedSpot.description ?? ""}
              onChange={(e) => updateSpot(selectedSpot.id, { description: e.target.value || undefined })}
              rows={2}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="What happens here?"
            />
          </div>
        </div>
      ) : null}
      </div>

      {!usingImage && centre ? (
        <p className="text-xs text-ink-soft">
          Tap “Add point”, then click the map to drop it. Drag any marker to move it — positions save when you hit
          Save.
        </p>
      ) : null}

      {!usingImage && centre ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              Measured areas ({zones.length})
            </p>
            {overlapping.size > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-bold text-red-700">
                {overlapping.size} area{overlapping.size === 1 ? "" : "s"} overlap
              </span>
            ) : null}
          </div>
          {zones.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-ink-soft">
              Use “Draw area” to trace an outline on the satellite map, or “Add area by size” to drop an exact
              rectangle in metres. Each area shows its size, footprint and perimeter, and clashes are flagged.
            </p>
          ) : null}
          {zones.map((z) => {
            const size = zoneSizeM(z);
            const clash = overlapping.has(z.id);
            return (
              <div
                key={z.id}
                onClick={() => setSelectedZone(z.id)}
                className={`cursor-pointer rounded-2xl bg-card p-4 ring-1 ${
                  selectedZone === z.id ? "ring-cherry" : clash ? "ring-red-400" : "ring-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: zoneColor(z) }} />
                  <input
                    value={z.name}
                    onChange={(e) => updateZone(z.id, { name: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"
                    placeholder="Area name e.g. Tented village"
                  />
                  <button
                    onClick={() => {
                      patch({ zones: zones.filter((o) => o.id !== z.id) });
                      if (selectedZone === z.id) setSelectedZone(null);
                    }}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-muted"
                    aria-label="Delete area"
                  >
                    <Trash2 className="h-4 w-4 text-ink-soft" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className="text-xs font-semibold text-ink-soft">
                    Width (m)
                    <input
                      type="number"
                      step="0.5"
                      value={Math.round(size.w * 10) / 10}
                      onChange={(e) => {
                        const w = Number(e.target.value);
                        if (w > 0) updateZone(z.id, resizeZone(z, w, size.h));
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-ink-soft">
                    Length (m)
                    <input
                      type="number"
                      step="0.5"
                      value={Math.round(size.h * 10) / 10}
                      onChange={(e) => {
                        const h = Number(e.target.value);
                        if (h > 0) updateZone(z.id, resizeZone(z, size.w, h));
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-1">
                    {ZONE_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateZone(z.id, { color: c })}
                        className={`h-6 w-6 rounded-full ring-1 ring-border ${
                          zoneColor(z) === c ? "ring-2 ring-offset-2 ring-cherry" : ""
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Colour ${c}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={zoneColor(z)}
                      onChange={(e) => updateZone(z.id, { color: e.target.value })}
                      className="h-6 w-8 cursor-pointer rounded border border-border bg-background"
                      aria-label="Custom colour"
                    />
                  </div>
                </div>
                <p className={`mt-2 text-[11px] font-semibold ${clash ? "text-red-600" : "text-ink-soft"}`}>
                  {formatArea(zoneAreaM2(z))} · {z.points.length} corners · {formatLength(zonePerimeterM(z))} perimeter
                  {clash ? " · overlaps another area" : ""}
                </p>
                <ZoneDuplicator
                  zone={z}
                  zones={zones}
                  onAdd={(copies) => {
                    patch({ zones: [...zones, ...copies] });
                    setSelectedZone(copies[0]?.id ?? z.id);
                  }}
                  onUpdate={(next) => updateZone(z.id, next)}
                />

              </div>
            );
          })}
        </div>
      ) : null}


      <div className="space-y-3">
        {map.hotspots.map((s) => (
          <div
            key={s.id}
            className={`rounded-2xl bg-card p-4 ring-1 ${selected === s.id ? "ring-cherry" : "ring-border"}`}
          >
            <div className="flex items-center gap-2">
              <input
                value={s.title}
                onChange={(e) => updateSpot(s.id, { title: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"
                placeholder="Point name"
              />
              <button
                onClick={() => patch({ hotspots: map.hotspots.filter((h) => h.id !== s.id) })}
                className="grid h-9 w-9 place-items-center rounded-lg bg-muted"
                aria-label="Delete point"
              >
                <Trash2 className="h-4 w-4 text-ink-soft" />
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select
                value={s.category}
                onChange={(e) => updateSpot(s.id, { category: e.target.value as VillageCategory })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {VILLAGE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={s.hours ?? ""}
                onChange={(e) => updateSpot(s.id, { hours: e.target.value || undefined })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Open hours e.g. 07:00 – 18:00"
              />
            </div>
            <textarea
              value={s.description ?? ""}
              onChange={(e) => updateSpot(s.id, { description: e.target.value || undefined })}
              rows={2}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="What happens here?"
            />
            <p className="mt-1 text-[11px] text-ink-soft">
              {Number.isFinite(s.lat) && Number.isFinite(s.lng)
                ? `Pinned at ${(s.lat as number).toFixed(5)}, ${(s.lng as number).toFixed(5)} — drag the marker to move it.`
                : `Position: ${s.x.toFixed(1)}% × ${s.y.toFixed(1)}% — drag the marker on the plan to move it.`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
