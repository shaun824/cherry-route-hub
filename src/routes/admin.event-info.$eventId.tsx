import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyEventInfo,
  fetchEventInfo,
  saveEventInfo,
  type EventInfoBlock,
} from "@/lib/event-info";
import { useServerFn } from "@tanstack/react-start";
import { resolveMapLink } from "@/lib/map-link.functions";
import { buildMapEmbedSrc, coordsFromMapInput, isShortMapLink } from "@/lib/map-embed";

export const Route = createFileRoute("/admin/event-info/$eventId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  component: EventInfoEditor,
});

function EventInfoEditor() {
  const { event } = Route.useLoaderData();
  const q = useQuery({ queryKey: ["event-info", event.id], queryFn: () => fetchEventInfo(event.id) });
  const [info, setInfo] = useState<EventInfoBlock>(() => emptyEventInfo(event.id));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapMsg, setMapMsg] = useState<string | null>(null);
  const [resolvingMap, setResolvingMap] = useState(false);
  const resolveLink = useServerFn(resolveMapLink);

  async function handleMapLink(value: string) {
    const url = value.trim();
    setMapMsg(null);
    if (!url) return;
    const pastedPoint = coordsFromMapInput(url);
    if (pastedPoint) {
      const normalizedUrl = `https://www.google.com/maps/search/?api=1&query=${pastedPoint.lat},${pastedPoint.lng}`;
      setInfo((prev) => ({
        ...prev,
        map_embed_url: normalizedUrl,
        venue_lat: pastedPoint.lat,
        venue_lng: pastedPoint.lng,
      }));
      setSaved(false);
      setMapMsg(`Pin set at ${pastedPoint.lat.toFixed(5)}, ${pastedPoint.lng.toFixed(5)}. Remember to save.`);
      return;
    }
    if (!isShortMapLink(url) && buildMapEmbedSrc({ mapUrl: url })) {
      setMapMsg("Map link looks good.");
      return;
    }
    setResolvingMap(true);
    try {
      const res = await resolveLink({ data: { url } });
      if (!res.ok) {
        setMapMsg(res.error);
        return;
      }
      setInfo((prev) => ({
        ...prev,
        map_embed_url: res.url,
        venue_lat: typeof res.lat === "number" ? res.lat : prev.venue_lat,
        venue_lng: typeof res.lng === "number" ? res.lng : prev.venue_lng,
        venue_address: prev.venue_address || res.place || null,
      }));
      setSaved(false);
      setMapMsg(
        typeof res.lat === "number"
          ? `Link expanded — pin set at ${res.lat.toFixed(5)}, ${res.lng!.toFixed(5)}. Remember to save.`
          : "Link expanded, but no pin found. Add the venue address or coordinates below.",
      );
    } catch {
      setMapMsg("Could not open that link. Try the full Google Maps URL from a browser.");
    } finally {
      setResolvingMap(false);
    }
  }

  useEffect(() => {
    if (q.data) setInfo(q.data);
  }, [q.data]);

  function patch<K extends keyof EventInfoBlock>(key: K, value: EventInfoBlock[K]) {
    setInfo((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const ok = await saveEventInfo(info);
    setSaving(false);
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/events"
          className="grid h-9 w-9 place-items-center rounded-full bg-card ring-1 ring-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
            Rider info · {event.name}
          </p>
          <h1 className="font-display text-xl font-bold text-ink">Event info blocks</h1>
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

      <Section title="Venue & parking">
        <Field
          label="Venue address"
          value={info.venue_address ?? ""}
          onChange={(v) => patch("venue_address", v || null)}
        />
        <div>
          <Field
            label="Google Maps link or coordinates"
            value={info.map_embed_url ?? ""}
            onChange={(v) => patch("map_embed_url", v || null)}
            onBlur={(v) => void handleMapLink(v)}
          />
          <p className="mt-1 text-[11px] text-ink-soft">
            {resolvingMap
              ? "Checking link…"
              : (mapMsg ?? "Paste a share link or coordinates such as 33°23'05.4\"S 25°54'38.3\"E, then tab out.")}
          </p>
          {(() => {
            const src = buildMapEmbedSrc({
              mapUrl: info.map_embed_url,
              lat: info.venue_lat,
              lng: info.venue_lng,
              address: info.venue_address,
            });
            if (!src) return null;
            return (
              <iframe
                title="Venue map preview"
                src={src}
                className="mt-2 h-40 w-full rounded-xl ring-1 ring-border"
                loading="lazy"
              />
            );
          })()}
        </div>
        <TextArea
          label="Parking / arrival notes"
          value={info.parking_notes ?? ""}
          onChange={(v) => patch("parking_notes", v || null)}
        />
      </Section>

      <Section title="Route">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Distance (km)"
            value={String(info.distance_km ?? "")}
            onChange={(v) => patch("distance_km", v ? Number(v) : null)}
            type="number"
          />
          <Field
            label="Elevation (m)"
            value={String(info.elevation_m ?? "")}
            onChange={(v) => patch("elevation_m", v ? Number(v) : null)}
            type="number"
          />
        </div>
        <TextArea
          label="Route description"
          value={info.route_description ?? ""}
          onChange={(v) => patch("route_description", v || null)}
          rows={4}
        />
        <Field
          label="GPX download URL"
          value={info.gpx_url ?? ""}
          onChange={(v) => patch("gpx_url", v || null)}
        />
      </Section>

      <Section title="Packing list">
        <ListEditor
          items={info.packing_list.map((p) => ({ key: p.key, label: p.label, essential: !!p.essential }))}
          columns={[
            { key: "label", label: "Item" },
            { key: "essential", label: "Essential", type: "check" },
          ]}
          onChange={(items) =>
            patch(
              "packing_list",
              items.map((it) => ({
                key: it.key || `item_${Math.random().toString(36).slice(2, 8)}`,
                label: String(it.label ?? ""),
                essential: Boolean(it.essential),
              })),
            )
          }
          newRow={{ label: "", essential: false }}
        />
      </Section>

      <Section title="Rules">
        <TextArea
          label="Rules (plain text or markdown)"
          value={info.rules_md ?? ""}
          onChange={(v) => patch("rules_md", v || null)}
          rows={6}
        />
      </Section>

      <Section title="FAQs">
        <ListEditor
          items={info.faqs}
          columns={[
            { key: "q", label: "Question" },
            { key: "a", label: "Answer", type: "textarea" },
          ]}
          onChange={(items) =>
            patch(
              "faqs",
              items.map((it) => ({ q: String(it.q ?? ""), a: String(it.a ?? "") })),
            )
          }
          newRow={{ q: "", a: "" }}
        />
      </Section>

      <Section title="Emergency contacts">
        <ListEditor
          items={info.emergency_contacts}
          columns={[
            { key: "label", label: "Label" },
            { key: "phone", label: "Phone" },
          ]}
          onChange={(items) =>
            patch(
              "emergency_contacts",
              items.map((it) => ({ label: String(it.label ?? ""), phone: String(it.phone ?? "") })),
            )
          }
          newRow={{ label: "", phone: "" }}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="font-display text-base font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

type ColumnDef = { key: string; label: string; type?: "text" | "textarea" | "check" };

function ListEditor({
  items,
  columns,
  onChange,
  newRow,
}: {
  items: any[];
  columns: ColumnDef[];
  onChange: (items: any[]) => void;
  newRow: Record<string, unknown>;
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-ink-soft">
          No items yet.
        </p>
      ) : null}
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border bg-background p-3">
          {columns.map((c) => {
            const val = (it as any)[c.key];
            if (c.type === "check") {
              return (
                <label key={c.key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...next[i], [c.key]: e.target.checked };
                      onChange(next);
                    }}
                  />
                  {c.label}
                </label>
              );
            }
            if (c.type === "textarea") {
              return (
                <label key={c.key} className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                    {c.label}
                  </span>
                  <textarea
                    value={String(val ?? "")}
                    rows={2}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...next[i], [c.key]: e.target.value };
                      onChange(next);
                    }}
                    className="mt-0.5 w-full rounded border border-border bg-card px-2 py-1 text-xs"
                  />
                </label>
              );
            }
            return (
              <label key={c.key} className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  {c.label}
                </span>
                <input
                  value={String(val ?? "")}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...next[i], [c.key]: e.target.value };
                    onChange(next);
                  }}
                  className="mt-0.5 w-full rounded border border-border bg-card px-2 py-1 text-xs"
                />
              </label>
            );
          })}
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[10px] font-semibold text-cherry-deep"
          >
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { ...newRow }])}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border bg-card px-3 py-1.5 text-xs font-semibold text-cherry-deep"
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  );
}
