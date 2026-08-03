import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  Check,
  Eye,
  EyeOff,
  Handshake,
  Image as ImageIcon,
  MapPin,
  Newspaper,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  Trophy,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import {
  QUICK_LINK_ICONS,
  saveBranding,
  saveQuickLinks,
  saveWaivers,
  saveFeatures,
  type Branding,
  type Features,
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

  // Lifted draft state so the preview panel can render pending changes
  // before the admin hits "Save".
  const [branding, setBranding] = useState<Branding>(settings.branding);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(settings.quickLinks);
  const [waivers, setWaivers] = useState<Waivers>(settings.waivers);
  useEffect(() => setBranding(settings.branding), [settings.branding]);
  useEffect(() => setQuickLinks(settings.quickLinks), [settings.quickLinks]);
  useEffect(() => setWaivers(settings.waivers), [settings.waivers]);

  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewTab, setPreviewTab] = useState<"home" | "waivers">("home");

  const anyDirty =
    JSON.stringify(branding) !== JSON.stringify(settings.branding) ||
    JSON.stringify(quickLinks) !== JSON.stringify(settings.quickLinks) ||
    JSON.stringify(waivers) !== JSON.stringify(settings.waivers);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-cherry">Site settings</p>
            <h1 className="font-display text-2xl font-bold">Branding &amp; static content</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Preview pending changes on the right before saving. Once saved, they go live instantly across the rider app.
            </p>
          </div>
          <button
            onClick={() => setPreviewOpen((v) => !v)}
            className="lg:hidden inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white"
          >
            {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {previewOpen ? "Hide preview" : "Preview"}
          </button>
        </header>

        <BrandingCard
          value={branding}
          onChange={setBranding}
          initial={settings.branding}
          onSaved={(b) => setSettings({ branding: b })}
        />
        <QuickLinksCard
          value={quickLinks}
          onChange={setQuickLinks}
          initial={settings.quickLinks}
          onSaved={(q) => setSettings({ quickLinks: q })}
        />
        <WaiversCard
          value={waivers}
          onChange={setWaivers}
          initial={settings.waivers}
          onSaved={(w) => setSettings({ waivers: w })}
        />
        <FeaturesCard
          value={settings.features}
          onSaved={(f) => setSettings({ features: f })}
        />
      </div>

      {/* Desktop sticky preview */}
      <aside className="hidden lg:block">
        <div className="sticky top-6">
          <PreviewPanel
            branding={branding}
            quickLinks={quickLinks}
            waivers={waivers}
            dirty={anyDirty}
            tab={previewTab}
            onTab={setPreviewTab}
          />
        </div>
      </aside>

      {/* Mobile slide-over preview */}
      {previewOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(92vw,380px)] overflow-y-auto bg-background p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Live preview</p>
              <button
                onClick={() => setPreviewOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md border border-border text-ink-soft"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PreviewPanel
              branding={branding}
              quickLinks={quickLinks}
              waivers={waivers}
              dirty={anyDirty}
              tab={previewTab}
              onTab={setPreviewTab}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Preview Panel ---------- */

function PreviewPanel({
  branding,
  quickLinks,
  waivers,
  dirty,
  tab,
  onTab,
}: {
  branding: Branding;
  quickLinks: QuickLink[];
  waivers: Waivers;
  dirty: boolean;
  tab: "home" | "waivers";
  onTab: (t: "home" | "waivers") => void;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cherry/10 text-cherry">
            <Smartphone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Rider preview</p>
            <p className="text-xs text-ink-soft">
              {dirty ? (
                <span className="font-semibold text-cherry">Unsaved changes shown</span>
              ) : (
                "Matches what's live"
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 text-xs font-semibold">
        {(["home", "waivers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`rounded-md px-2 py-1.5 capitalize ${
              tab === t ? "bg-card text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {t === "home" ? "Home" : "Entry waivers"}
          </button>
        ))}
      </div>

      {/* Phone frame */}
      <div className="mt-3 overflow-hidden rounded-[2rem] bg-ink p-2 ring-1 ring-border">
        <div className="relative h-[520px] overflow-hidden rounded-[1.6rem] bg-background">
          <div className="pointer-events-none absolute left-1/2 top-1 z-10 h-4 w-16 -translate-x-1/2 rounded-b-2xl bg-ink" />
          <div className="h-full overflow-y-auto">
            {tab === "home" ? (
              <HomePreview branding={branding} quickLinks={quickLinks} />
            ) : (
              <WaiverPreview waivers={waivers} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePreview({ branding, quickLinks }: { branding: Branding; quickLinks: QuickLink[] }) {
  const enabled = quickLinks.filter((q) => q.enabled);
  const cols = Math.min(Math.max(enabled.length, 1), 4);
  return (
    <div className="pb-4">
      <div className="cherry-gradient relative overflow-hidden px-4 pb-7 pt-8 text-white">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 font-black">RC</span>
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.18em] opacity-80">
                {branding.eyebrow}
              </p>
              <h1 className="font-display text-lg font-bold leading-tight">{branding.tagline}</h1>
            </div>
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
            <Bell className="h-4 w-4" />
          </span>
        </div>
        <div className="relative mt-5">
          <p className="text-xs opacity-85">{branding.welcomeMessage}</p>
          <p className="font-display text-base font-bold">Alex Rider</p>
        </div>
      </div>

      {enabled.length > 0 ? (
        <div
          className="-mt-4 grid gap-1.5 px-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {enabled.map((q) => {
            const Icon = ICONS[q.icon] ?? Sparkles;
            return (
              <div
                key={q.id}
                className="flex flex-col items-center gap-1 rounded-xl bg-card p-2 shadow-sm ring-1 ring-border"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-cherry-deep">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <span className="text-[9px] font-semibold text-ink">{q.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mx-3 mt-3 rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-ink-soft">
          No quick links enabled — riders will see the hero only.
        </div>
      )}

      <div className="mt-5 px-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
          Upcoming events
        </p>
        <div className="mt-2 rounded-xl bg-gradient-to-br from-cherry to-cherry-deep p-3 text-white">
          <p className="text-[9px] font-semibold uppercase tracking-widest opacity-80">Gravel</p>
          <p className="mt-3 font-display text-sm font-bold">Karoo Gravel Grinder</p>
          <p className="mt-1 text-[10px] opacity-85">Sat 12 Sep · Prince Albert</p>
        </div>
      </div>
    </div>
  );
}

function WaiverPreview({ waivers }: { waivers: Waivers }) {
  return (
    <div className="p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
        Step 4 · Entry form
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Waivers &amp; terms</h2>
      <div className="mt-4 space-y-4 rounded-2xl bg-card p-3 ring-1 ring-border">
        <div>
          <label className="flex items-start gap-2">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-border bg-background">
              <Check className="h-3 w-3 text-cherry" />
            </span>
            <span className="text-[12px] leading-relaxed text-ink">
              {waivers.waiverText || (
                <span className="italic text-ink-soft">Waiver line is empty</span>
              )}
            </span>
          </label>
          {waivers.waiverFullText ? (
            <p className="mt-1.5 ml-6 text-[10px] leading-relaxed text-ink-soft">
              {waivers.waiverFullText}
            </p>
          ) : null}
        </div>
        <div>
          <label className="flex items-start gap-2">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-border bg-background">
              <Check className="h-3 w-3 text-cherry" />
            </span>
            <span className="text-[12px] leading-relaxed text-ink">
              {waivers.termsText || (
                <span className="italic text-ink-soft">Terms line is empty</span>
              )}
            </span>
          </label>
          {waivers.termsFullText ? (
            <p className="mt-1.5 ml-6 text-[10px] leading-relaxed text-ink-soft">
              {waivers.termsFullText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Branding ---------- */

function BrandingCard({
  value,
  onChange,
  initial,
  onSaved,
}: {
  value: Branding;
  onChange: (b: Branding) => void;
  initial: Branding;
  onSaved: (b: Branding) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const form = value;
  const setForm = onChange;
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
        <Field label="Title sponsor name (home banner)">
          <input
            className={input()}
            value={form.titleSponsorName ?? ""}
            placeholder="e.g. M&G Investments"
            onChange={(e) => setForm({ ...form, titleSponsorName: e.target.value })}
          />
        </Field>
        <Field label="Title sponsor website">
          <input
            className={input()}
            value={form.titleSponsorUrl ?? ""}
            placeholder="https://sponsor.co.za"
            onChange={(e) => setForm({ ...form, titleSponsorUrl: e.target.value })}
          />
        </Field>
        <Field label="Title sponsor logo URL (shown on the home banner)">
          <input
            className={input()}
            value={form.titleSponsorLogoUrl ?? ""}
            placeholder="https://…/logo.png"
            onChange={(e) => setForm({ ...form, titleSponsorLogoUrl: e.target.value })}
          />
          {form.titleSponsorLogoUrl ? (
            <div className="mt-2 inline-flex items-center rounded-lg bg-ink p-2">
              <img
                src={form.titleSponsorLogoUrl}
                alt="Title sponsor preview"
                className="h-8 max-w-[160px] object-contain"
              />
            </div>
          ) : null}
        </Field>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={submit} />
    </section>
  );
}

/* ---------- Quick links ---------- */

function QuickLinksCard({
  value,
  onChange,
  initial,
  onSaved,
}: {
  value: QuickLink[];
  onChange: (q: QuickLink[]) => void;
  initial: QuickLink[];
  onSaved: (q: QuickLink[]) => void;
}) {
  const items = value;
  const setItems = onChange;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = useMemo(() => JSON.stringify(items) !== JSON.stringify(initial), [items, initial]);

  const update = (id: string, patch: Partial<QuickLink>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id: string) => setItems(items.filter((it) => it.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const add = () =>
    setItems([
      ...items,
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
              className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-xl border border-border bg-background p-2 md:grid-cols-[auto_auto_1.2fr_1.2fr_auto_auto]"
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
                onChange={(e) => update(it.id, { icon: e.target.value as QuickLinkIcon })}
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

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={submit} />
    </section>
  );
}

/* ---------- Waivers ---------- */

function WaiversCard({
  value,
  onChange,
  initial,
  onSaved,
}: {
  value: Waivers;
  onChange: (w: Waivers) => void;
  initial: Waivers;
  onSaved: (w: Waivers) => void;
}) {
  const form = value;
  const setForm = onChange;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
      {dirty ? (
        <span className="mr-auto inline-flex items-center gap-1 rounded-full bg-cherry/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cherry">
          Unsaved
        </span>
      ) : null}
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

/* ---------- Features Card ---------- */

function FeaturesCard({ value, onSaved }: { value: Features; onSaved: (f: Features) => void }) {
  const [draft, setDraft] = useState<Features>(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  async function commit() {
    setSaving(true);
    const ok = await saveFeatures(draft);
    setSaving(false);
    if (ok) onSaved(draft);
  }

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Feature flags</h2>
          <p className="text-xs text-ink-soft">
            Turn app-wide features on or off. Currently entries live on Entry Ninja and this app
            is the rider companion.
          </p>
        </div>
        <button
          onClick={() => void commit()}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
        <div>
          <p className="text-sm font-semibold text-ink">In-app entries</p>
          <p className="text-xs text-ink-soft">
            When on, riders can enter events inside the app. When off, we deep-link to Entry Ninja.
          </p>
        </div>
        <input
          type="checkbox"
          checked={draft.entriesEnabled}
          onChange={(e) => setDraft({ ...draft, entriesEnabled: e.target.checked })}
          className="h-5 w-9 shrink-0"
        />
      </label>
    </section>
  );
}

