// Admin: infrastructure rental jobs (weddings, corporate days, other clients).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Copy, MapPin, Package, Plus, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRentalShareToken } from "@/lib/rentals.functions";

export const Route = createFileRoute("/admin/rentals")({
  head: () => ({
    meta: [
      { title: "Infrastructure rentals · Admin · Red Cherry Events" },
      { name: "description", content: "Set up client pages for Red Cherry infrastructure rentals." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminRentals,
});

type Rental = {
  id: string;
  name: string;
  client_name: string | null;
  client_contact: string | null;
  location: string;
  event_date: string;
  build_date: string | null;
  breakdown_date: string | null;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
};

const blank = {
  name: "", client_name: "", client_contact: "", location: "", event_date: "",
  build_date: "", breakdown_date: "", description: "", cover_url: "", is_public: false,
};
type Form = typeof blank;

function AdminRentals() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [msg, setMsg] = useState<string | null>(null);
  const shareFn = useServerFn(getRentalShareToken);

  const q = useQuery({
    queryKey: ["admin-rentals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("events")
        .select("id, name, client_name, client_contact, location, event_date, build_date, breakdown_date, description, cover_url, is_public")
        .eq("event_type", "rental")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Rental[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.event_date) throw new Error("Name and event date are required.");
      const row = {
        name: form.name.trim(),
        client_name: form.client_name || null,
        client_contact: form.client_contact || null,
        location: form.location || "",
        event_date: new Date(form.event_date + "T08:00:00+02:00").toISOString(),
        build_date: form.build_date || null,
        breakdown_date: form.breakdown_date || null,
        description: form.description || null,
        cover_url: form.cover_url || null,
        is_public: form.is_public,
        event_type: "rental",
        discipline: "Infrastructure",
      };
      const sb = supabase as any;
      const { error } = editing === "new" ? await sb.from("events").insert(row) : await sb.from("events").update(row).eq("id", editing);
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); setMsg("Saved."); qc.invalidateQueries({ queryKey: ["admin-rentals"] }); },
    onError: (e: Error) => setMsg(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-rentals"] }),
  });

  async function copyLink(id: string, reset = false) {
    if (reset && !confirm("Reset the link? The old link will stop working.")) return;
    try {
      const { token } = await shareFn({ data: { eventId: id, reset } });
      const url = `${window.location.origin}/rental/${token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setMsg(`${reset ? "New link" : "Link"} copied: ${url}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  function open(r?: Rental) {
    setMsg(null);
    if (!r) { setForm(blank); setEditing("new"); return; }
    setForm({
      name: r.name, client_name: r.client_name ?? "", client_contact: r.client_contact ?? "",
      location: r.location ?? "", event_date: r.event_date?.slice(0, 10) ?? "",
      build_date: r.build_date ?? "", breakdown_date: r.breakdown_date ?? "",
      description: r.description ?? "", cover_url: r.cover_url ?? "", is_public: r.is_public,
    });
    setEditing(r.id);
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Infrastructure rentals</h1>
          <p className="text-sm text-ink-soft">Client jobs using our kit. Each gets a private page with dates, venue map, run sheet and equipment.</p>
        </div>
        <button onClick={() => open()} className="flex shrink-0 items-center gap-1 rounded-xl cherry-gradient px-3 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> New rental
        </button>
      </header>

      {msg ? <p className="break-all rounded-xl bg-muted p-3 text-sm text-ink">{msg}</p> : null}

      {editing ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <input className={input} placeholder="Event name (e.g. Smith wedding)" value={form.name} onChange={set("name")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Client name" value={form.client_name} onChange={set("client_name")} />
            <input className={input} placeholder="Client contact (name, phone)" value={form.client_contact} onChange={set("client_contact")} />
          </div>
          <input className={input} placeholder="Venue / location" value={form.location} onChange={set("location")} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-ink-soft">Build date<input type="date" className={input} value={form.build_date} onChange={set("build_date")} /></label>
            <label className="text-xs text-ink-soft">Event date<input type="date" className={input} value={form.event_date} onChange={set("event_date")} /></label>
            <label className="text-xs text-ink-soft">Breakdown date<input type="date" className={input} value={form.breakdown_date} onChange={set("breakdown_date")} /></label>
          </div>
          <input className={input} placeholder="Cover photo URL (optional)" value={form.cover_url} onChange={set("cover_url")} />
          <textarea className={input} rows={4} placeholder="Notes for the client" value={form.description} onChange={set("description")} />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
            Show publicly in the rider app
          </label>
          <div className="flex gap-2">
            <button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl cherry-gradient px-4 py-2 text-sm font-bold text-white">
              {save.isPending ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-xl border border-border px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      ) : null}

      {q.isLoading ? <div className="h-32 animate-pulse rounded-2xl bg-muted" /> : null}
      {q.data?.length === 0 ? <p className="text-sm text-ink-soft">No rental jobs yet.</p> : null}

      <ul className="space-y-3">
        {q.data?.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => open(r)} className="min-w-0 text-left">
                <p className="font-semibold text-ink">{r.name}</p>
                <p className="text-xs text-ink-soft">
                  {[r.client_name, r.location, new Date(r.event_date).toLocaleDateString("en-ZA")].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{r.is_public ? "Public" : "Private"}</p>
              </button>
              <button onClick={() => confirm(`Delete ${r.name}?`) && remove.mutate(r.id)} aria-label="Delete" className="text-ink-soft hover:text-cherry">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <button onClick={() => copyLink(r.id)} className="flex items-center gap-1 rounded-full bg-cherry px-3 py-1.5 text-white"><Copy className="h-3.5 w-3.5" /> Copy client link</button>
              <button onClick={() => copyLink(r.id, true)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><RefreshCw className="h-3.5 w-3.5" /> Reset link</button>
              <Link to="/admin/village/$eventId" params={{ eventId: r.id }} className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><MapPin className="h-3.5 w-3.5" /> Village map</Link>
              <Link to="/admin/run-sheet" search={{ event: r.id }} className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><ClipboardList className="h-3.5 w-3.5" /> Run sheet</Link>
              <Link to="/crew/inventory" onClick={() => localStorage.setItem("rce:crew-event", r.id)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><Package className="h-3.5 w-3.5" /> Equipment</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
