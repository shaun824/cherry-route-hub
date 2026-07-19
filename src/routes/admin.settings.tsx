import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  Check,
  GripVertical,
  Handshake,
  Image as ImageIcon,
  MapPin,
  Newspaper,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Trophy,
  Type as TypeIcon,
} from "lucide-react";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import {
  QUICK_LINK_ICONS,
  saveBranding,
  saveQuickLinks,
  saveWaivers,
  type Branding,
  type QuickLink,
  type QuickLinkIcon,
  type Waivers,
} from "@/lib/settings";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Site settings · Admin · Red Cherry Events" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminSettings,
});

const ICONS: Record<QuickLinkIcon, typeof Newspaper> = {
  Newspaper,
  MapPin,
  Image: ImageIcon,
  Tag,
  Bell,
  Sparkles,
  ShieldCheck,
  Handshake,
  Trophy,
  Calendar,
};

function AdminSettings() {
  useHydratedStore();
  const settings = useAdminStore((s) => s.settings);
  const setSettings = useAdminStore((s) => s.setSettings);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-widest text-cherry">Site settings</p>
        <h1 className="font-display text-2xl font-bold">Branding &amp; static content</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Manage the app name, tagline, home dashboard quick links, and legal copy (waivers &amp; terms).
          Changes go live instantly across the rider app.
        </p>
      </header>

      <BrandingCard initial={settings.branding} onSaved={(b) => setSettings({ branding: b })} />
      <QuickLinksCard initial={settings.quickLinks} onSaved={(q) => setSettings({ quickLinks: q })} />
      <WaiversCard initial={settings.waivers} onSaved={(w) => setSettings({ waivers: w })} />
    </div>
  );
}

/* ---------- Branding ---------- */

function BrandingCard({
  initial,
  onSaved,
}: {
  initial: Branding;
  onSaved: (b: Branding) => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(initial), [initial]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  const submit = async () => {
    setSaving(true);
    const ok = await saveBranding(form);
    setSaving(false);
    if (ok) {
      onSaved(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-cherry/10 text-cherry">
          <TypeIcon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display font-bold text-ink">Branding</h2>
          <p className="text-xs text-ink-soft">Shown on the home hero and throughout the app.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="App name">
          <input
            className={input()}
            value={form.appName}
            onChange={(e) => setForm({ ...form, appName: e.target.value })}
          />
        </Field>
        <Field label="Tagline">
          <input
            className={input()}
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </Field>
        <Field label="Eyebrow (small caps above name)">
          <input
            className={input()}
            value={form.eyebrow}
            onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Welcome message">
          <input
            className={input()}
            value={form.welcomeMessage}
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl cherry-gradient p-3 text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
            {form.eyebrow}
          </p>
          <p className="font-display text-lg font-bold leading-tight">{form.tagline}</p>
          <p className="mt-1 text-[11px] opacity-80">
            {form.welcomeMessage} <b>{form.appName}</b>
          </p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/15 font-black">
          RC
        </span>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={submit} />
    </section>
  );
}

/* ---------- Quick links ---------- */

function QuickLinksCard({
  initial,
  onSaved,
}: {
  initial: QuickLink[];
  onSaved: (q: QuickLink[]) => void;
}) {
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setItems(initial), [initial]);

  const dirty = useMemo(() => JSON.stringify(items) !== JSON.stringify(initial), [items, initial]);

  const update = (id: string, patch: Partial<QuickLink>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = () =>
    setItems((prev) => [
      ...prev,
      {
        id: `ql_${Math.random().toString(36).slice(2, 8)}`,
        label: "New link",
        to: "/",
        icon: "Sparkles",
        enabled: true,
      },
    ]);

  const submit = async () => {
    setSaving(true);
    const ok = await saveQuickLinks(items);
    setSaving(false);
    if (ok) {
      onSaved(items);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-cherry/10 text-cherry">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display font-bold text-ink">Home quick links</h2>
          <p className="text-xs text-ink-soft">
            Up to a handful of tiles under the hero. Riders only see the ones marked enabled.
          </p>
        </div>
        <button
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((it, i) => {
          const Icon = ICONS[it.icon] ?? Sparkles;
          return (
            <li
              key={it.id}
              className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-xl border border-border bg-background p-2 md:grid-cols-[auto_auto_1.2fr_1.2fr_auto_auto]`}
            >
              <div className="flex flex-col">
                <button
                  aria-label="Move up"
                  onClick={() => move(it.id, -1)}
                  disabled={i === 0}
                  className="text-ink-soft disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  aria-label="Move down"
                  onClick={() => move(it.id, 1)}
                  disabled={i === items.length - 1}
                  className="text-ink-soft disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-cherry-deep">
                <Icon className="h-4 w-4" />
              </span>
              <input
                className={input()}
                value={it.label}
                onChange={(e) => update(it.id, { label: e.target.value })}
                placeholder="Label"
              />
              <input
                className={input() + " font-mono text-xs md:col-span-1 col-span-3"}
                value={it.to}
                onChange={(e) => update(it.id, { to: e.target.value })}
                placeholder="/path"
              />
              <select
                className={input() + " col-span-2 md:col-span-1"}
                value={it.icon}
                onChange={(e) =>
                  update(it.id, { icon: e.target.value as QuickLinkIcon })
                }
              >
                {QUICK_LINK_ICONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <div className="col-span-4 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
                <label className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={it.enabled}
                    onChange={(e) => update(it.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <button
                  aria-label="Delete link"
                  onClick={() => remove(it.id)}
                  className="rounded-md border border-border p-1.5 text-ink-soft hover:bg-secondary"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
            No quick links yet.
          </li>
        ) : null}
      </ul>

      <div className="mt-4 rounded-xl bg-secondary/60 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Preview</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {items
            .filter((it) => it.enabled)
            .slice(0, 8)
            .map((q) => {
              const Icon = ICONS[q.icon] ?? Sparkles;
              return (
                <div
                  key={q.id}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 ring-1 ring-border"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-cherry-deep">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold text-ink">{q.label}</span>
                </div>
              );
            })}
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={submit} />
    </section>
  );
}

/* ---------- Waivers ---------- */

function WaiversCard({
  initial,
  onSaved,
}: {
  initial: Waivers;
  onSaved: (w: Waivers) => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(initial), [initial]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  const submit = async () => {
    setSaving(true);
    const ok = await saveWaivers(form);
    setSaving(false);
    if (ok) {
      onSaved(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-cherry/10 text-cherry">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display font-bold text-ink">Waivers &amp; terms</h2>
          <p className="text-xs text-ink-soft">
            Displayed on the event entry form. Short lines sit next to the tick boxes; full text is
            shown expanded.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Waiver tick-box line">
          <input
            className={input()}
            value={form.waiverText}
            onChange={(e) => setForm({ ...form, waiverText: e.target.value })}
          />
        </Field>
        <Field label="Full waiver text">
          <textarea
            className={input() + " min-h-24 leading-relaxed"}
            value={form.waiverFullText}
            onChange={(e) => setForm({ ...form, waiverFullText: e.target.value })}
          />
        </Field>
        <Field label="Terms tick-box line">
          <input
            className={input()}
            value={form.termsText}
            onChange={(e) => setForm({ ...form, termsText: e.target.value })}
          />
        </Field>
        <Field label="Full terms text">
          <textarea
            className={input() + " min-h-24 leading-relaxed"}
            value={form.termsFullText}
            onChange={(e) => setForm({ ...form, termsFullText: e.target.value })}
          />
        </Field>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={submit} />
    </section>
  );
}

/* ---------- shared bits ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

function input() {
  return "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink focus:border-cherry focus:outline-none focus:ring-2 focus:ring-cherry/20";
}

function SaveBar({
  dirty,
  saving,
  saved,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      {saved ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" /> Saved
        </span>
      ) : null}
      <button
        onClick={onSave}
        disabled={!dirty || saving}
        className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-40"
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

// keep GripVertical used to avoid unused import warnings if refactored
void GripVertical;
