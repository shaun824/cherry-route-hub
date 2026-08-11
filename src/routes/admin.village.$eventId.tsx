import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  VILLAGE_CATEGORIES,
  categoryMeta,
  emptyVillageMap,
  fetchVillageMap,
  saveVillageMap,
  type VillageCategory,
  type VillageHotspot,
  type VillageGeo,
  type VillageMap,
} from "@/lib/village-map";

export const Route = createFileRoute("/admin/village/$eventId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
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
  const { event } = Route.useLoaderData();
  const q = useQuery({ queryKey: ["village-map", event.id], queryFn: () => fetchVillageMap(event.id) });
  const [map, setMap] = useState<VillageMap>(() => emptyVillageMap(event.id));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<string | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.data) setMap(q.data);
  }, [q.data]);

  function patch(next: Partial<VillageMap>) {
    setMap((prev) => ({ ...prev, ...next }));
    setSaved(false);
  }

  function patchGeo(next: Partial<VillageGeo>) {
    const base: VillageGeo = map.geo ?? { lat: 0, lng: 0, widthM: 500, rotation: 0 };
    patch({ geo: { ...base, ...next } });
  }

  function updateSpot(id: string, next: Partial<VillageHotspot>) {
    patch({ hotspots: map.hotspots.map((s) => (s.id === id ? { ...s, ...next } : s)) });
  }

  function coordsFromEvent(e: React.MouseEvent) {
    const el = imgWrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(100, Math.max(0, +x.toFixed(2))), y: Math.min(100, Math.max(0, +y.toFixed(2))) };
  }

  function handleMapClick(e: React.MouseEvent) {
    if (!placing) return;
    const c = coordsFromEvent(e);
    if (!c) return;
    const spot: VillageHotspot = {
      id: crypto.randomUUID(),
      x: c.x,
      y: c.y,
      title: "New point",
      category: "other",
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
            {map.image_url ? "Replace map image" : "Upload map image"}
          </button>
          {map.image_url ? (
            <button
              onClick={() => patch({ image_url: null })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-ink"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove image
            </button>
          ) : null}
          <button
            onClick={() => setPlacing((p) => !p)}
            disabled={!map.image_url}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
              placing ? "bg-cherry text-white" : "bg-muted text-ink"
            }`}
          >
            {placing ? "Click the map to place…" : "Add point"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Real-world placement (so riders see their live GPS on the map)
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <label className="text-xs font-semibold text-ink-soft">
            Centre latitude
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
            Centre longitude
            <input
              type="number"
              step="0.00001"
              value={map.geo?.lng ?? ""}
              onChange={(e) => patchGeo({ lng: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="18.89250"
            />
          </label>
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
        <p className="mt-2 text-[11px] text-ink-soft">
          Paste the venue centre from Google Maps, then nudge the width and rotation until the plan lines up with
          the satellite image on the rider view. Leave blank to keep the plain plan view only.
        </p>
      </div>

      {map.image_url ? (
        <div
          ref={imgWrapRef}
          onClick={handleMapClick}
          onMouseMove={handleMouseMove}
          onMouseUp={() => (dragRef.current = null)}
          onMouseLeave={() => (dragRef.current = null)}
          className={`relative overflow-hidden rounded-2xl ring-1 ring-border ${placing ? "cursor-crosshair" : ""}`}
        >
          <img src={map.image_url} alt="Village map" className="block w-full select-none" draggable={false} />
          {map.hotspots.map((s) => {
            const meta = categoryMeta(s.category);
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
                style={{ left: `${s.x}%`, top: `${s.y}%`, backgroundColor: meta.color }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full px-2 py-1 text-[10px] font-bold text-white shadow ${
                  selected === s.id ? "ring-2 ring-cherry" : ""
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-soft">
          Upload a village map image (site plan, illustration or aerial photo) to start placing points.
        </div>
      )}

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
              Position: {s.x.toFixed(1)}% × {s.y.toFixed(1)}% — drag the marker on the map to move it.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
