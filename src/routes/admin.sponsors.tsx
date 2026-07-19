import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { useAdminStore, newId, type Sponsor } from "@/lib/store";
import { SponsorScroller } from "@/components/sponsor-scroller";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/sponsors")({
  component: AdminSponsors,
});

function blank(): Sponsor {
  return {
    id: newId("sp"),
    name: "",
    tier: "Gold",
    logoText: "",
    accent: "oklch(0.5 0.15 25)",
    url: "",
    active: true,
  };
}

// Uploads a logo to the private `sponsor-logos` bucket and returns a long-lived
// signed URL. (Public buckets are blocked in this workspace.)
async function uploadSponsorLogo(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("sponsor-logos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("sponsor-logos")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // ~10 years
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Sign URL failed");
  return data.signedUrl;
}

const tierOrder: Sponsor["tier"][] = ["Platinum", "Gold", "Silver", "Bronze"];

function AdminSponsors() {
  const sponsors = useAdminStore((s) => s.sponsors);
  const upsert = useAdminStore((s) => s.upsertSponsor);
  const del = useAdminStore((s) => s.deleteSponsor);
  const [editing, setEditing] = useState<Sponsor | null>(null);

  const sorted = [...sponsors].sort(
    (a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier),
  );

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Sponsors</h1>
          <p className="text-sm text-ink-soft">
            Manage the continuously scrolling logo bar shown on Home and Promos.
          </p>
        </div>
        <button
          onClick={() => setEditing(blank())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> New sponsor
        </button>
      </header>

      {/* Live preview */}
      <div className="mb-6 rounded-2xl bg-card p-1 ring-1 ring-border">
        <div className="rounded-xl bg-background p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
            Live preview
          </p>
          <SponsorScroller title="" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((sp) => (
          <div
            key={sp.id}
            className={`rounded-xl bg-card p-4 ring-1 ${sp.active ? "ring-border" : "ring-dashed ring-border opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {sp.logoUrl ? (
                  <img
                    src={sp.logoUrl}
                    alt={sp.name}
                    className="h-12 w-12 shrink-0 rounded-md bg-white object-contain p-1 ring-1 ring-border"
                  />
                ) : (
                  <div
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-[10px] font-black text-white"
                    style={{ background: sp.accent }}
                  >
                    {(sp.logoText || sp.name || "?").slice(0, 4)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                    {sp.tier}
                  </p>
                  <p className="truncate font-display text-base font-bold">{sp.name}</p>
                  {sp.url ? (
                    <p className="truncate text-xs text-ink-soft">{sp.url}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => upsert({ ...sp, active: !sp.active })}
                  className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                  aria-label={sp.active ? "Hide" : "Show"}
                >
                  {sp.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setEditing(sp)}
                  className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${sp.name}?`)) del(sp.id);
                  }}
                  className="rounded-md p-1.5 text-cherry hover:bg-accent"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 ? (
          <div className="col-span-full rounded-2xl bg-card p-8 text-center text-sm text-ink-soft ring-1 ring-border">
            No sponsors yet.
          </div>
        ) : null}
      </div>

      {editing ? (
        <SponsorEditor
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

function SponsorEditor({
  value,
  onSave,
  onCancel,
}: {
  value: Sponsor;
  onSave: (s: Sponsor) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Sponsor>(value);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  function update<K extends keyof Sponsor>(k: K, v: Sponsor[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function onPick(file: File | undefined) {
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const url = await uploadSponsorLogo(file);
      setForm((f) => ({ ...f, logoUrl: url }));
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-lg font-bold">
            {value.name ? "Edit sponsor" : "New sponsor"}
          </h3>
          <button onClick={onCancel} className="rounded-md p-1.5 text-ink-soft hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <L label="Sponsor name">
            <input className={i} value={form.name} onChange={(e) => update("name", e.target.value)} />
          </L>
          <L label="Tier">
            <select
              className={i}
              value={form.tier}
              onChange={(e) => update("tier", e.target.value as Sponsor["tier"])}
            >
              {tierOrder.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </L>
          <L label="Logo text (short)">
            <input
              className={i}
              value={form.logoText}
              onChange={(e) => update("logoText", e.target.value.toUpperCase())}
              placeholder="ACME"
            />
          </L>
          <L label="Website URL">
            <input
              className={i}
              value={form.url ?? ""}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://…"
            />
          </L>
          <L label="Accent color" className="md:col-span-2">
            <input
              className={i}
              value={form.accent}
              onChange={(e) => update("accent", e.target.value)}
              placeholder="oklch(0.55 0.2 25) or #d81a1a"
            />
          </L>
          <label className="col-span-full flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update("active", e.target.checked)}
              className="h-4 w-4 accent-[oklch(0.55_0.23_25)]"
            />
            Show on scroller
          </label>
          <div className="col-span-full rounded-lg bg-secondary/60 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
              Preview
            </p>
            <p className="font-display text-xl font-black" style={{ color: form.accent }}>
              {form.logoText || form.name || "LOGO"}
            </p>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
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
            Save sponsor
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
