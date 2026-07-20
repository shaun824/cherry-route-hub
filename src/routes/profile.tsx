import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { useSession, signOut } from "@/lib/auth";
import { LogOut, Save, User as UserIcon, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Red Cherry Events" },
      { name: "description", content: "Manage your Red Cherry rider profile." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Profile,
});

type ProfileForm = {
  full_name: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  jacket_size: string;
  tshirt_size: string;
  entry_ninja_id: string;
};

const empty: ProfileForm = {
  full_name: "",
  phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  jacket_size: "",
  tshirt_size: "",
  entry_ninja_id: "",
};

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

function Profile() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [initialLoad, setInitialLoad] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setInitialLoad(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,phone,emergency_contact_name,emergency_contact_phone,jacket_size,tshirt_size,entry_ninja_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && data) {
        setForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          emergency_contact_name: data.emergency_contact_name ?? "",
          emergency_contact_phone: data.emergency_contact_phone ?? "",
          jacket_size: data.jacket_size ?? "",
          tshirt_size: data.tshirt_size ?? "",
          entry_ninja_id: data.entry_ninja_id ?? "",
        });
      }
      setInitialLoad(false);
    })();
  }, [loading, user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name || null,
        phone: form.phone || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        jacket_size: form.jacket_size || null,
        tshirt_size: form.tshirt_size || null,
        entry_ninja_id: form.entry_ninja_id || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) setMsg({ kind: "err", text: error.message });
    else setMsg({ kind: "ok", text: "Profile saved." });
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || initialLoad) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-ink-soft">Loading profile…</div>;
  }

  if (!user) {
    return (
      <div>
        <PageHeader title="Profile" subtitle="Sign in to view and edit your profile" />
        <div className="mx-5 mt-6 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-ink-soft">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <p className="mt-3 font-display font-bold">You're not signed in</p>
          <p className="mt-1 text-sm text-ink-soft">Sign in to manage your rider details.</p>
          <Link
            to="/auth"
            search={{ next: "/profile" }}
            className="mt-4 inline-flex rounded-lg bg-cherry px-4 py-2 text-sm font-bold text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Profile"
        subtitle={user.email ?? "Rider profile"}
        right={
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        }
      />

      <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-cherry-deep">
          <UserIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display font-bold">{form.full_name || user.email}</p>
          <p className="truncate text-xs text-ink-soft">{user.email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="mx-5 mt-4 space-y-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <Field label="Full name">
          <input
            className="input"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Your name"
          />
        </Field>

        <Field label="Phone">
          <input
            className="input"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+27 …"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Emergency contact">
            <input
              className="input"
              value={form.emergency_contact_name}
              onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
              placeholder="Name"
            />
          </Field>
          <Field label="Emergency phone">
            <input
              className="input"
              type="tel"
              value={form.emergency_contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
              placeholder="+27 …"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="T-shirt size">
            <select
              className="input"
              value={form.tshirt_size}
              onChange={(e) => setForm((f) => ({ ...f, tshirt_size: e.target.value }))}
            >
              <option value="">—</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Jacket size">
            <select
              className="input"
              value={form.jacket_size}
              onChange={(e) => setForm((f) => ({ ...f, jacket_size: e.target.value }))}
            >
              <option value="">—</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Entry Ninja ID">
          <input
            className="input"
            value={form.entry_ninja_id}
            onChange={(e) => setForm((f) => ({ ...f, entry_ninja_id: e.target.value }))}
            placeholder="Optional — for entry sync"
          />
        </Field>

        {msg ? (
          <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-600" : "text-cherry"}`}>{msg.text}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-ink-soft"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.6rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.55rem 0.7rem;
          font-size: 0.875rem;
          color: hsl(var(--ink));
        }
        .input:focus { outline: 2px solid hsl(var(--cherry) / 0.4); outline-offset: 1px; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
