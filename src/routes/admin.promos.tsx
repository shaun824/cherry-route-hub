import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useAdminStore, newId } from "@/lib/store";
import type { Promo } from "@/lib/mock-data";

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
              <div className="min-w-0">
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: p.accent }}
                >
                  {p.brand}
                </p>
                <p className="font-display text-base font-bold text-ink">{p.title}</p>
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
                {p.code}
              </code>
              <span className="rounded bg-accent px-2 py-1 font-bold text-cherry-deep">
                {p.discount}
              </span>
              <span className="text-ink-soft">Exp {p.expires}</span>
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
  function update<K extends keyof Promo>(k: K, v: Promo[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-lg font-bold">
            {value.title ? "Edit promo" : "New promo"}
          </h3>
          <button onClick={onCancel} className="rounded-md p-1.5 text-ink-soft hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-4 p-5 md:grid-cols-2">
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
          <L label="Promo code">
            <input className={i} value={form.code} onChange={(e) => update("code", e.target.value)} />
          </L>
          <L label="Expires">
            <input
              type="date"
              className={i}
              value={form.expires}
              onChange={(e) => update("expires", e.target.value)}
            />
          </L>
          <L label="Accent color (CSS)" className="md:col-span-2">
            <input
              className={i}
              value={form.accent}
              onChange={(e) => update("accent", e.target.value)}
              placeholder="oklch(0.55 0.2 25) or #ff0000"
            />
          </L>
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
