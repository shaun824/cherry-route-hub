import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { useAdminStore, newId } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import type { Promo } from "@/lib/mock-data";

// Reuses the private `sponsor-logos` bucket and returns a long-lived signed URL.
async function uploadPromoLogo(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `promo-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("sponsor-logos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("sponsor-logos")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Sign URL failed");
  return data.signedUrl;
}

export const Route = createFileRoute("/admin/promos")({
  component: AdminPromos,
});

function blank(): Promo {
  return {
    id: newId("promo"),
    brand: "",
    title: "",
    code: "",
    discount: "10% off",
    expires: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    accent: "oklch(0.55 0.2 25)",
    blurb: "",
    redeem: "",
    eventMatch: "",
    active: true,
  };
}

function AdminPromos() {
  const promos = useAdminStore((s) => s.promos);
  const upsert = useAdminStore((s) => s.upsertPromo);
  const del = useAdminStore((s) => s.deletePromo);
  const [editing, setEditing] = useState<Promo | null>(null);

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Supplier promos</h1>
          <p className="text-sm text-ink-soft">Manage discount codes and sponsor offers.</p>
        </div>
        <button
          onClick={() => setEditing(blank())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> New promo
        </button>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {promos.map((p) => (
          <div key={p.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex items-start justify-between">
              <div className="flex min-w-0 items-start gap-3">
                {p.logoUrl ? (
                  <img
                    src={p.logoUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md bg-white object-contain p-1 ring-1 ring-border"
                  />
                ) : null}
                <div className="min-w-0">
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: p.accent }}
                >
                  {p.brand}
                </p>
                <p className="font-display text-base font-bold text-ink">{p.title}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing(p)}
                  className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this promo?")) del(p.id);
                  }}
                  className="rounded-md p-1.5 text-cherry hover:bg-accent"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <code className="rounded bg-secondary px-2 py-1 font-mono font-bold text-ink">
                {p.code || p.redeem || "In store"}
              </code>
              <span className="rounded bg-accent px-2 py-1 font-bold text-cherry-deep">
                {p.discount}
              </span>
              {p.expires ? <span className="text-ink-soft">Exp {p.expires}</span> : null}
              {p.active === false ? (
                <span className="rounded bg-secondary px-2 py-1 font-bold text-ink-soft">Hidden</span>
              ) : null}
              <span className="text-ink-soft">
                {p.eventMatch?.trim() ? `Events: ${p.eventMatch}` : "All events"}
              </span>
            </div>
          </div>
        ))}
        {promos.length === 0 ? (
          <div className="col-span-full rounded-2xl bg-card p-8 text-center text-sm text-ink-soft ring-1 ring-border">
            No promos yet.
          </div>
        ) : null}
      </div>

      {editing ? (
        <PromoEditor
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

function PromoEditor({
  value,
  onSave,
  onCancel,
}: {
  value: Promo;
  onSave: (p: Promo) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Promo>(value);
  const events = useAdminStore((s) => s.events);
  const openEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return events
      .filter(
        (e) =>
          e.lifecycle !== "archived" &&
          (e.status === "open" || e.status === "live" || (e.date ?? "").slice(0, 10) >= today),
      )
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [events]);
  const selected = useMemo(
    () =>
      (form.eventMatch ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [form.eventMatch],
  );
  function toggleEvent(name: string) {
    const key = name.toLowerCase();
    const next = selected.includes(key)
      ? selected.filter((s) => s !== key)
      : [...selected, key];
    setForm((f) => ({ ...f, eventMatch: next.join(", ") }));
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  function update<K extends keyof Promo>(k: K, v: Promo[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onPick(file?: File) {
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const url = await uploadPromoLogo(file);
      setForm((f) => ({ ...f, logoUrl: url }));
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/50 p-4 sm:items-center">
      <div className="my-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-lg font-bold">
            {value.title ? "Edit promo" : "New promo"}
          </h3>
          <button onClick={onCancel} className="rounded-md p-1.5 text-ink-soft hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid flex-1 gap-4 overflow-y-auto overscroll-contain p-5 md:grid-cols-2">

          <L label="Brand">
            <input className={i} value={form.brand} onChange={(e) => update("brand", e.target.value)} />
          </L>
          <L label="Discount">
            <input
              className={i}
              value={form.discount}
              onChange={(e) => update("discount", e.target.value)}
            />
          </L>
          <L label="Title" className="md:col-span-2">
            <input className={i} value={form.title} onChange={(e) => update("title", e.target.value)} />
          </L>
          <L label="Description shown to riders" className="md:col-span-2">
            <textarea
              className={`${i} min-h-20`}
              value={form.blurb ?? ""}
              onChange={(e) => update("blurb", e.target.value)}
              placeholder="Redeemable at the event only — visit the stand in the village."
            />
          </L>
          <L label="Promo code">
            <input className={i} value={form.code} onChange={(e) => update("code", e.target.value)} />
          </L>
          <L label="How to redeem (when there is no code)">
            <input
              className={i}
              value={form.redeem ?? ""}
              onChange={(e) => update("redeem", e.target.value)}
              placeholder="Claim in store at the stand"
            />
          </L>
          <L label="Expires">
            <input
              type="date"
              className={i}
              value={form.expires}
              onChange={(e) => update("expires", e.target.value)}
            />
          </L>
          <L label="Show on events" className="md:col-span-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {openEvents.length === 0 ? (
                <span className="text-[11px] text-ink-soft">No open events found.</span>
              ) : (
                openEvents.map((ev) => {
                  const on = selected.includes(ev.name.toLowerCase());
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => toggleEvent(ev.name)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        on
                          ? "border-cherry bg-cherry text-white"
                          : "border-border bg-background text-ink-soft"
                      }`}
                    >
                      {ev.name}
                    </button>
                  );
                })
              )}
            </div>
            <input
              className={i}
              value={form.eventMatch ?? ""}
              onChange={(e) => update("eventMatch", e.target.value)}
              placeholder="weekend warrior, addo, plett"
            />
            <span className="mt-1 block text-[11px] text-ink-soft">
              Tap events above, or type keywords. Leave blank to show this offer on every event.
            </span>
          </L>

          <L label="Visible to riders" className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={(e) => update("active", e.target.checked)}
              />
              Show this offer in the app
            </label>
          </L>
          <L label="Sponsor website (discount link)" className="md:col-span-2">
            <input
              className={i}
              value={form.url ?? ""}
              onChange={(e) => update("url", e.target.value || undefined)}
              placeholder="https://sponsor.co.za/shop"
            />
            <span className="mt-1 block text-[11px] text-ink-soft">
              Riders tap the discount badge to open this link in a new tab.
            </span>
          </L>

          <div className="md:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Sponsor logo
            </span>
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background p-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-white ring-1 ring-border">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo preview" className="max-h-14 max-w-14 object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-ink-soft" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => onPick(e.target.files?.[0])}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {uploading ? "Uploading…" : form.logoUrl ? "Replace" : "Upload logo"}
                  </button>
                  {form.logoUrl ? (
                    <button
                      type="button"
                      onClick={() => update("logoUrl", undefined)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-cherry"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-soft">PNG, JPG, SVG or WEBP. Square/transparent logos look best.</p>
                {uploadErr ? (
                  <p className="mt-1 text-[11px] font-semibold text-cherry">{uploadErr}</p>
                ) : null}
              </div>
            </div>
          </div>

          <L label="Accent color (CSS)" className="md:col-span-2">
            <input
              className={i}
              value={form.accent}
              onChange={(e) => update("accent", e.target.value)}
              placeholder="oklch(0.55 0.2 25) or #ff0000"
            />
          </L>
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
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
            Save promo
          </button>
        </footer>
      </div>
    </div>
  );
}

const i =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cherry focus:ring-2 focus:ring-cherry/20";
function L({
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
