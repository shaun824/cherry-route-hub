import { createFileRoute, ClientOnly, Link, notFound, useBlocker, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, MapPin, PencilRuler, Save, Sparkles, Square, Tent, Trash2, Upload, X } from "lucide-react";
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
  zoneCentroid,
  toMetres,
  ZONE_KINDS,
  type ZoneKind,
  type VillageZone,
  type ZonePoint,

} from "@/lib/village-zones";
import ZoneDuplicator from "@/components/zone-duplicator";
import { BrandingToPlace } from "@/components/branding-to-place";
import { toast } from "sonner";

import { fetchVillageTents, TENT_TYPES, type TentType } from "@/lib/village-tents";

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
  // "See everything" shows ALL placements across every layer at once; the
  // layer switch still decides where newly added points land.
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [centreToken, setCentreToken] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [tentMode, setTentMode] = useState(false);
  const [selectedTent, setSelectedTent] = useState<string | null>(null);
  /** Live rotation while the slider is being dragged — saved once on release. */
  const [rotDraft, setRotDraft] = useState<number | null>(null);
  const [nextTentLabel, setNextTentLabel] = useState("1");
  // 'tent' drops a real tent number (shown to riders); 'marker' drops a helper
  // point used only for drawing areas — never rendered on rider-facing maps.
  const [tentKind, setTentKind] = useState<"tent" | "marker">("tent");
  // Luxury (4x4m) and RCE (2x2m) tents share ONE number sequence — no duplicates.
  const [tentType, setTentType] = useState<TentType>("rce");
  const qc = useQueryClient();
  const tentsQ = useQuery({
    queryKey: ["village-tents", event.id, venueId],
    queryFn: () => fetchVillageTents(event.id, venueId),
  });
  const tents = tentsQ.data ?? [];

  // Unsaved-changes guard: the snapshot of the last loaded/saved map. Any edit
  // makes `dirty` true and blocks navigation until the admin saves or confirms
  // they want to discard.
  const savedSnapshotRef = useRef<string | null>(null);
  const mapJson = useMemo(() => JSON.stringify(map), [map]);
  const dirty = savedSnapshotRef.current !== null && mapJson !== savedSnapshotRef.current;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useBlocker({
    shouldBlockFn: async () => {
      if (!dirtyRef.current) return false;
      return !window.confirm("You have unsaved village map changes. Leave and lose them?");
    },
    enableBeforeUnload: () => dirtyRef.current,
  });

  // Switching village: clear the editor immediately so nothing from the previous
  // village can be saved onto the new one.
  useEffect(() => {
    setMap(emptyVillageMap(event.id, venueId));
    savedSnapshotRef.current = null;
    setSelected(null);
    setSelectedZone(null);
    setSelectedTent(null);
  }, [venueId, event.id]);


  /** Lowest unused number across BOTH tent types. */
  function nextFreeTentNumber() {
    const used = new Set(
      tents
        .filter((t) => t.kind !== "marker")
        .map((t) => Number(t.label.match(/\d+/)?.[0] ?? NaN))
        .filter((n) => Number.isFinite(n)),
    );
    let n = 1;
    while (used.has(n)) n += 1;
    return String(n);
  }

  function bumpLabel(label: string) {
    const n = Number(label.match(/\d+$/)?.[0] ?? NaN);
    if (!Number.isFinite(n)) return label;
    return label.replace(/\d+$/, String(n + 1));
  }

  /** Next free number at or after `label`'s number, ignoring `justUsed`. */
  function freeLabelFrom(label: string, justUsed: string[] = []) {
    const used = new Set(
      [...tents.filter((t) => t.kind !== "marker").map((t) => t.label), ...justUsed]
        .map((l) => Number(String(l).match(/\d+/)?.[0] ?? NaN))
        .filter((n) => Number.isFinite(n)),
    );
    let n = Number(label.match(/\d+$/)?.[0] ?? NaN);
    if (!Number.isFinite(n)) return label;
    while (used.has(n)) n += 1;
    return label.replace(/\d+$/, String(n));
  }

  async function placeTent(lat: number, lng: number) {
    let label = nextTentLabel.trim() || nextFreeTentNumber();
    if (tentKind === "tent") {
      // Dropping a tent must never silently do nothing: if the number in the
      // box is already on the field, roll on to the next free number instead.
      const free = freeLabelFrom(label);
      if (free !== label) {
        toast.message(`Tent ${label} already exists — dropped tent ${free} instead.`);
        label = free;
      }
    }
    const zone = zones.find((z) => pointInZone({ lat, lng }, z)) ?? null;
    const { error } = await supabase.from("event_village_tents").insert({
      event_id: event.id,
      venue_id: venueId,
      label,
      lat,
      lng,
      zone_id: zone?.id ?? null,
      kind: tentKind,
      tent_type: tentKind === "tent" ? tentType : "rce",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (tentKind === "tent") setNextTentLabel(freeLabelFrom(bumpLabel(label), [label]));
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }


  async function moveTent(id: string, lat: number, lng: number) {
    const zone = zones.find((z) => pointInZone({ lat, lng }, z)) ?? null;
    await supabase.from("event_village_tents").update({ lat, lng, zone_id: zone?.id ?? null }).eq("id", id);
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }

  /** Optimistically patch one tent pin, then persist it. */
  async function patchTent(
    id: string,
    patch: { rotation?: number; tent_type?: TentType; zone_id?: string | null; lat?: number; lng?: number },
  ) {
    qc.setQueryData(
      ["village-tents", event.id, venueId],
      (current: typeof tents | undefined) =>
        current?.map((t) => (t.id === id ? { ...t, ...patch } : t)) ?? current,
    );
    const { error } = await supabase.from("event_village_tents").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }

  /** Show a rotation on the map without hitting the database (slider drag). */
  function previewTentRotation(id: string, degrees: number) {
    const next = (((Math.round(degrees) % 360) + 360) % 360);
    qc.setQueryData(
      ["village-tents", event.id, venueId],
      (current: typeof tents | undefined) =>
        current?.map((t) => (t.id === id ? { ...t, rotation: next } : t)) ?? current,
    );
  }

  /** Turn a tent pin so its square footprint matches how it is pitched. */
  async function rotateTent(id: string, byDegrees: number) {
    const tent = tents.find((t) => t.id === id);
    if (!tent) return;
    await setTentRotation(id, (tent.rotation ?? 0) + byDegrees);
  }

  async function setTentRotation(id: string, degrees: number) {
    const next = (((Math.round(degrees) % 360) + 360) % 360);
    await patchTent(id, { rotation: next });
  }

  /** Straighten every tent to match the one that's already set right. */
  async function applyRotationToAllTents(id: string) {
    const tent = tents.find((t) => t.id === id);
    if (!tent) return;
    const next = (((Math.round(tent.rotation ?? 0) % 360) + 360) % 360);
    const ids = tents.filter((t) => (t.kind ?? "tent") !== "marker").map((t) => t.id);
    if (ids.length === 0) return;
    qc.setQueryData(
      ["village-tents", event.id, venueId],
      (current: typeof tents | undefined) =>
        current?.map((t) => (ids.includes(t.id) ? { ...t, rotation: next } : t)) ?? current,
    );
    const { error } = await supabase
      .from("event_village_tents")
      .update({ rotation: next })
      .in("id", ids);
    if (error) toast.error(error.message);
    else toast.success(`All ${ids.length} tents turned to ${next}°.`);
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }


  /** Swap a pin between the 2x2m standard tent and the 4x4m luxury tent. */
  async function setTentTypeFor(id: string, type: TentType) {
    await patchTent(id, { tent_type: type });
  }

  /** Drop a pin into a drawn area: attach it and, if it sits outside, move it in. */
  async function assignTentToZone(id: string, zoneId: string | null) {
    const tent = tents.find((t) => t.id === id);
    if (!tent) return;
    const zone = zones.find((z) => z.id === zoneId) ?? null;
    if (!zone) {
      await patchTent(id, { zone_id: null });
      return;
    }
    const inside = pointInZone({ lat: tent.lat, lng: tent.lng }, zone);
    const centre = zoneCentroid(zone);
    const patch: { zone_id: string; lat?: number; lng?: number } = { zone_id: zone.id };
    if (!inside && centre) {
      patch.lat = centre.lat;
      patch.lng = centre.lng;
    }
    await patchTent(id, patch);
  }

  /** Line a tent up with the longest edge of its area, so rows sit straight. */
  function zoneBearing(zone: VillageZone): number {
    const pts = zone.points ?? [];
    if (pts.length < 2) return 0;
    const ref = pts[0];
    let best = 0;
    let bestLen = -1;
    for (let i = 0; i < pts.length; i++) {
      const a = toMetres(ref, pts[i]);
      const b = toMetres(ref, pts[(i + 1) % pts.length]);
      const de = b.e - a.e;
      const dn = b.n - a.n;
      const len = Math.hypot(de, dn);
      if (len > bestLen) {
        bestLen = len;
        best = (Math.atan2(de, dn) * 180) / Math.PI;
      }
    }
    return ((Math.round(best) % 90) + 90) % 90;
  }

  async function alignTentToZone(id: string) {
    const tent = tents.find((t) => t.id === id);
    const zone = zones.find((z) => z.id === tent?.zone_id);
    if (!tent || !zone) {
      toast.message("Put the tent in an area first, then align it.");
      return;
    }
    await setTentRotation(id, zoneBearing(zone));
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
    const { data: deleted, error } = await supabase
      .from("event_village_tents")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) {
      toast.error(`Could not delete that pin: ${error.message}`);
      throw error;
    }
    if (!deleted) {
      const denied = new Error("The pin was not deleted. Please refresh your sign-in and try again.");
      toast.error(denied.message);
      throw denied;
    }
    setSelectedTent(null);
    qc.setQueryData(
      ["village-tents", event.id, venueId],
      (current: typeof tents | undefined) => current?.filter((tent) => tent.id !== id) ?? [],
    );
    toast.success("Tent pin deleted");
    await qc.invalidateQueries({ queryKey: ["village-tents", event.id, venueId] });
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<string | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.data) return;
    const loaded = { ...q.data, venue_id: venueId };
    const next =
      !hasVenueCentre(loaded.geo) && info?.venue_lat && info?.venue_lng
        ? { ...loaded, geo: { lat: info.venue_lat, lng: info.venue_lng, widthM: 0 } }
        : loaded;
    setMap(next);
    savedSnapshotRef.current = JSON.stringify(next);
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

  function layerSpots(all: VillageHotspot[]) {
    // "See everything" overrides the layer filter for a one-glance overview.
    if (showAll) return all;
    // Rider points stay visible as context while building, but only the active
    // layer is added to; on a build layer we hide the other build layer.
    return all.filter((s) => spotLayer(s) === layer || spotLayer(s) === "rider");
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

  function deleteZone(id: string) {
    patch({ zones: zones.filter((o) => o.id !== id) });
    if (selectedZone === id) setSelectedZone(null);
  }

  function addQuickArea() {
    if (!centre) return;
    const zone = rectangleZone(centre, 10, 10, `Area ${zones.length + 1}`);
    zone.color = ZONE_COLORS[zones.length % ZONE_COLORS.length];
    patch({ zones: [...zones, zone] });
    setSelectedZone(zone.id);
    setPlacing(false);
    setDrawing(false);
    setTentMode(false);
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

  /** Drops a branding pin for a crew booking; returns the new point id. */
  function placeBookingPin(b: { name: string; qty: number; size_spec: string | null; placement: string | null }) {
    if (!centre) {
      alert("Set the venue location first, then place branding.");
      return null;
    }
    const spot: VillageHotspot = {
      id: crypto.randomUUID(),
      x: 50,
      y: 50,
      lat: +centre.lat.toFixed(6),
      lng: +centre.lng.toFixed(6),
      title: b.name,
      category: "branding",
      layer: "branding",
      spec: [b.qty > 1 ? `${b.qty} ×` : null, b.size_spec, b.placement].filter(Boolean).join(" · ") || undefined,
    };
    patch({ hotspots: [...map.hotspots, spot] });
    setSelected(spot.id);
    setCentreToken((t) => t + 1);
    return spot.id;
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
    if (ok) {
      savedSnapshotRef.current = JSON.stringify(map);
      setTimeout(() => setSaved(false), 2000);
    }
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
          className={`inline-flex items-center gap-1.5 rounded-lg cherry-gradient px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 ${dirty ? "ring-2 ring-amber-300 ring-offset-1" : ""}`}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : saved ? "Saved!" : dirty ? "Save (unsaved changes)" : "Save"}
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
        {tentMode && tentKind === "tent" ? (
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-border">
            {TENT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTentType(t.id)}
                className={`px-2.5 py-1.5 text-[11px] font-bold ${
                  tentType === t.id ? "bg-cherry text-white" : "bg-muted text-ink-soft"
                }`}
              >
                {t.name} {t.sizeM}x{t.sizeM}m
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
          <div className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-secondary p-2 text-[11px] font-bold text-ink-soft">
            <span className="rounded bg-background px-2 py-1 text-ink">
              Tent {tents.find((t) => t.id === selectedTent)?.label ?? ""}
            </span>

            <span className="inline-flex items-center gap-1">
              Size
              <span className="inline-flex overflow-hidden rounded-lg ring-1 ring-border">
                {TENT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => void setTentTypeFor(selectedTent, t.id)}
                    className={`px-2 py-1 ${
                      (tents.find((x) => x.id === selectedTent)?.tent_type ?? "rce") === t.id
                        ? "bg-cherry text-white"
                        : "bg-background text-ink-soft"
                    }`}
                  >
                    {t.name} {t.sizeM}×{t.sizeM}m
                  </button>
                ))}
              </span>
            </span>

            <span className="inline-flex items-center gap-1">
              Turn
              <button
                onClick={() => void rotateTent(selectedTent, -15)}
                className="rounded bg-background px-2 py-1 text-ink"
                title="Turn 15° anti-clockwise"
              >
                ↺
              </button>
              <button
                onClick={() => void rotateTent(selectedTent, -1)}
                className="rounded bg-background px-2 py-1 text-ink"
                title="Turn 1° anti-clockwise"
              >
                −1°
              </button>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={rotDraft ?? Math.round(tents.find((t) => t.id === selectedTent)?.rotation ?? 0)}
                onChange={(e) => {
                  const deg = Number(e.target.value);
                  setRotDraft(deg);
                  previewTentRotation(selectedTent, deg);
                }}
                onPointerUp={() => {
                  if (rotDraft == null) return;
                  const deg = rotDraft;
                  setRotDraft(null);
                  void setTentRotation(selectedTent, deg);
                }}
                onBlur={() => {
                  if (rotDraft == null) return;
                  const deg = rotDraft;
                  setRotDraft(null);
                  void setTentRotation(selectedTent, deg);
                }}
                className="w-32 accent-[hsl(var(--cherry))]"
              />
              <button
                onClick={() => void rotateTent(selectedTent, 1)}
                className="rounded bg-background px-2 py-1 text-ink"
                title="Turn 1° clockwise"
              >
                +1°
              </button>
              <button
                onClick={() => void rotateTent(selectedTent, 15)}
                className="rounded bg-background px-2 py-1 text-ink"
                title="Turn 15° clockwise"
              >
                ↻
              </button>
              <span className="tabular-nums text-ink">
                {Math.round(tents.find((t) => t.id === selectedTent)?.rotation ?? 0)}°
              </span>
              <button
                onClick={() => void setTentRotation(selectedTent, 0)}
                className="rounded bg-background px-2 py-1 text-ink"
                title="Square the tent up with north"
              >
                Square up
              </button>
              <button
                onClick={() => void applyRotationToAllTents(selectedTent)}
                className="rounded bg-cherry px-2 py-1 font-bold text-white"
                title="Turn every tent to this same angle"
              >
                Match all tents
              </button>
            </span>

            <span className="inline-flex items-center gap-1">
              Area
              <select
                value={tents.find((t) => t.id === selectedTent)?.zone_id ?? ""}
                onChange={(e) => void assignTentToZone(selectedTent, e.target.value || null)}
                className="rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-ink"
              >
                <option value="">No area</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void alignTentToZone(selectedTent)}
                className="rounded bg-background px-2 py-1 text-ink"
                title="Line the tent up with the area's longest edge"
              >
                Align to area
              </button>
            </span>

            <button
              onClick={() => {
                const id = selectedTent;
                setSelectedTent(null);
                void deleteTent(id);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete tent pin
            </button>
          </div>
        ) : null}
        <button
          onClick={addQuickArea}
          disabled={usingImage || !centre}
          className="inline-flex items-center gap-1.5 rounded-lg cherry-gradient px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5" /> Add 10×10m area
        </button>
        <button
          onClick={addRectangle}
          disabled={usingImage || !centre}
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5" /> Add area by size
        </button>
        <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-border">
          {VILLAGE_LAYERS.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setLayer(l.id);
                setSelected(null);
              }}
              title={l.blurb}
              className={`px-2.5 py-1.5 text-[11px] font-bold ${
                layer === l.id ? "bg-cherry text-white" : "bg-muted text-ink-soft"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          title="Show every point from all layers at once"
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold ring-1 ring-border ${
            showAll ? "bg-cherry text-white" : "bg-muted text-ink-soft"
          }`}
        >
          <Eye className="h-3.5 w-3.5" /> See everything
        </button>
        {layer !== "rider" ? (
          <button
            onClick={loadBuildKit}
            disabled={usingImage || !centre}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Load build kit
          </button>
        ) : null}
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
            {layerSpots(map.hotspots).map((s) => {
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
              defaultBearing={map.geo?.bearing ?? 0}
              onSaveBearing={(b) => patchGeo({ bearing: b })}
              centre={centre}
              centreToken={centreToken}
              hotspots={layerSpots(map.hotspots)}
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
              onDeleteZone={deleteZone}
              onPatchZone={updateZone}
              tents={tents.map((t) => ({
                id: t.id,
                label: t.label,
                lat: t.lat,
                lng: t.lng,
                kind: t.kind,
                tent_type: t.tent_type,
                rotation: t.rotation,
              }))}
              tentMode={tentMode}
              onPlaceTent={placeTent}
              onMoveTent={moveTent}
              onSelectTent={setSelectedTent}
              selectedTent={selectedTent}
              onDeleteTent={deleteTent}
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
                value={spotLayer(selectedSpot)}
                onChange={(e) => {
                  const next = e.target.value as VillageLayer;
                  const cats = BUILD_CATEGORIES[next];
                  updateSpot(selectedSpot.id, {
                    layer: next,
                    category: cats.includes(selectedSpot.category)
                      ? selectedSpot.category
                      : (cats[0] ?? "other"),
                  });
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {VILLAGE_LAYERS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedSpot.category}
                onChange={(e) => updateSpot(selectedSpot.id, { category: e.target.value as VillageCategory })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {VILLAGE_CATEGORIES.filter((c) =>
                  BUILD_CATEGORIES[spotLayer(selectedSpot)].includes(c.id),
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {spotLayer(selectedSpot) === "rider" ? (
                <input
                  value={selectedSpot.hours ?? ""}
                  onChange={(e) => updateSpot(selectedSpot.id, { hours: e.target.value || undefined })}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Open hours e.g. 07:00 – 18:00"
                />
              ) : (
                <input
                  value={selectedSpot.spec ?? ""}
                  onChange={(e) => updateSpot(selectedSpot.id, { spec: e.target.value || undefined })}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Quantity + size e.g. 3 × 3m gazebo"
                />
              )}
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
            <textarea
              value={selectedSpot.crewNotes ?? ""}
              onChange={(e) => updateSpot(selectedSpot.id, { crewNotes: e.target.value || undefined })}
              rows={2}
              className="mt-2 w-full rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm"
              placeholder="Crew only notes — setup detail, who owns it, timings (riders never see this)"
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
                <div className="mt-3 rounded-xl bg-muted/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                    Crew-only build detail
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-ink-soft">
                      Area type
                      <select
                        value={z.kind ?? ""}
                        onChange={(e) => {
                          const kind = (e.target.value || undefined) as ZoneKind | undefined;
                          const preset = ZONE_KINDS.find((k) => k.id === kind);
                          updateZone(z.id, preset ? { kind, color: preset.color } : { kind });
                        }}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Untyped area</option>
                        {ZONE_KINDS.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-ink-soft">
                      Contains (kit list)
                      <input
                        value={z.spec ?? ""}
                        onChange={(e) => updateZone(z.id, { spec: e.target.value })}
                        placeholder="e.g. 9×12 Bedouin, 20 trestles, 2 light towers"
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="mt-2 block text-xs font-semibold text-ink-soft">
                    Build / strike notes
                    <textarea
                      value={z.crewNotes ?? ""}
                      onChange={(e) => updateZone(z.id, { crewNotes: e.target.value })}
                      rows={2}
                      placeholder="Anchor points, power feed, who builds it, strike order…"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <p className="mt-1 text-[10px] text-ink-soft">
                    Riders never see these fields — crew and admins only.
                  </p>
                </div>

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


      {layer === "branding" ? (
        <BrandingToPlace eventId={event.id} onPlace={(b) => placeBookingPin(b)} />
      ) : null}

      <div className="space-y-3">
        {layerSpots(map.hotspots).map((s) => (
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
                value={spotLayer(s)}
                onChange={(e) => {
                  const next = e.target.value as VillageLayer;
                  const cats = BUILD_CATEGORIES[next];
                  updateSpot(s.id, {
                    layer: next,
                    category: cats.includes(s.category) ? s.category : (cats[0] ?? "other"),
                  });
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {VILLAGE_LAYERS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <select
                value={s.category}
                onChange={(e) => updateSpot(s.id, { category: e.target.value as VillageCategory })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {VILLAGE_CATEGORIES.filter((c) => BUILD_CATEGORIES[spotLayer(s)].includes(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {spotLayer(s) === "rider" ? (
                <input
                  value={s.hours ?? ""}
                  onChange={(e) => updateSpot(s.id, { hours: e.target.value || undefined })}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Open hours e.g. 07:00 – 18:00"
                />
              ) : (
                <input
                  value={s.spec ?? ""}
                  onChange={(e) => updateSpot(s.id, { spec: e.target.value || undefined })}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Quantity + size e.g. 60kVA"
                />
              )}
            </div>
            <textarea
              value={s.description ?? ""}
              onChange={(e) => updateSpot(s.id, { description: e.target.value || undefined })}
              rows={2}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="What happens here?"
            />
            <textarea
              value={s.crewNotes ?? ""}
              onChange={(e) => updateSpot(s.id, { crewNotes: e.target.value || undefined })}
              rows={2}
              className="mt-2 w-full rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm"
              placeholder="Crew only notes — setup detail, who owns it, timings (riders never see this)"
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
