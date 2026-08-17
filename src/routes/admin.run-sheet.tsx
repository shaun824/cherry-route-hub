// Admin: link an event's master run sheet (Google Sheet), sync departments,
// daily instructions and packing lists, assign crew and review suggestions.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ClipboardList, Eye, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { previewRunSheet, syncRunSheet } from "@/lib/run-sheet.functions";

export const Route = createFileRoute("/admin/run-sheet")({
  head: () => ({
    meta: [
      { title: "Run sheets · Admin · Red Cherry Events" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminRunSheet,
});

type Tab = "sheet" | "suggestions" | "waivers";

function AdminRunSheet() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("sheet");
  const [eventId, setEventId] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const preview = useServerFn(previewRunSheet);
  const sync = useServerFn(syncRunSheet);

  const eventsQ = useQuery({
    queryKey: ["events-run-sheet"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, run_sheet_url, run_sheet_synced_at, run_sheet_error")
        .order("event_date", { ascending: false });
      return (data ?? []) as {
        id: string;
        name: string;
        run_sheet_url: string | null;
        run_sheet_synced_at: string | null;
        run_sheet_error: string | null;
      }[];
    },
  });
  const events = eventsQ.data ?? [];
  const event = events.find((e) => e.id === eventId);

  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0].id);
  }, [events, eventId]);
  useEffect(() => {
    setUrl(event?.run_sheet_url ?? "");
  }, [event?.id, event?.run_sheet_url]);

  const saveM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("events")
        .update({ run_sheet_url: url.trim() || null })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg("Sheet link saved.");
      qc.invalidateQueries({ queryKey: ["events-run-sheet"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const previewM = useMutation({
    mutationFn: () => preview({ data: { eventId } }),
    onError: (e: Error) => setMsg(e.message),
  });

  const syncM = useMutation({
    mutationFn: () => sync({ data: { eventId } }),
    onSuccess: () => {
      setMsg("Run sheet synced.");
      qc.invalidateQueries({ queryKey: ["events-run-sheet"] });
      qc.invalidateQueries({ queryKey: ["crew-departments", eventId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const deptQ = useQuery({
    queryKey: ["admin-departments", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_departments")
        .select("id, name, lead_name, contact")
        .eq("event_id", eventId)
        .order("sort_order");
      return (data ?? []) as { id: string; name: string; lead_name: string | null; contact: string | null }[];
    },
  });

  const suggQ = useQuery({
    queryKey: ["packing-suggestions", eventId],
    enabled: tab === "suggestions" && !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("packing_suggestions")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      return (data ?? []) as {
        id: string;
        department_id: string;
        item: string;
        notes: string | null;
        status: string;
        created_by_name: string | null;
        created_at: string;
      }[];
    },
  });

  const decideM = useMutation({
    mutationFn: async (v: { id: string; approve: boolean; departmentId: string; item: string; notes: string | null }) => {
      if (v.approve) {
        const { error } = await supabase.from("department_packing_items").insert({
          department_id: v.departmentId,
          item: v.item,
          notes: v.notes,
          source: "crew",
          sort_order: 999,
        });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("packing_suggestions")
        .update({ status: v.approve ? "approved" : "rejected" })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packing-suggestions", eventId] }),
    onError: (e: Error) => setMsg(e.message),
  });

  const waiverQ = useQuery({
    queryKey: ["crew-waivers", eventId],
    enabled: tab === "waivers" && !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("crew_waivers")
        .select("id, full_name, accepted_at, department_id, waiver_version")
        .eq("event_id", eventId)
        .order("accepted_at", { ascending: false });
      return (data ?? []) as {
        id: string;
        full_name: string;
        accepted_at: string;
        department_id: string | null;
        waiver_version: string;
      }[];
    },
  });

  const deptName = (id: string | null) =>
    (deptQ.data ?? []).find((d) => d.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <header className="flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-bold">Run sheets</h1>
      </header>
      <p className="mt-1 text-sm text-ink-soft">
        Link the master Google Sheet for an event, sync it, and manage what crew see on site.
      </p>

      <select
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        className="mt-4 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      <div className="mt-4 flex gap-2">
        {(["sheet", "suggestions", "waivers"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "border border-border bg-card text-ink-soft"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {msg ? <p className="mt-3 text-sm text-primary">{msg}</p> : null}

      {tab === "sheet" ? (
        <section className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Google Sheet link
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="mt-2 text-xs text-ink-soft">
              Tabs read: <strong>Run Sheet</strong>, <strong>Packing</strong>, <strong>Brief</strong>. Share
              the sheet with anyone-with-link viewer access.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveM.mutate()}
                disabled={saveM.isPending || !eventId}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Save link
              </button>
              <button
                type="button"
                onClick={() => previewM.mutate()}
                disabled={previewM.isPending || !eventId}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {previewM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Preview
              </button>
              <button
                type="button"
                onClick={() => syncM.mutate()}
                disabled={syncM.isPending || !eventId}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {syncM.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync now
              </button>
            </div>
            {event?.run_sheet_synced_at ? (
              <p className="mt-2 text-xs text-ink-soft">
                Last synced {new Date(event.run_sheet_synced_at).toLocaleString()}
              </p>
            ) : null}
            {event?.run_sheet_error ? (
              <p className="mt-1 text-xs text-destructive">{event.run_sheet_error}</p>
            ) : null}
          </div>

          {previewM.data ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p className="font-semibold">
                {previewM.data.departments.length} departments · {previewM.data.taskCount} tasks ·{" "}
                {previewM.data.packingCount} packing items · {previewM.data.briefCount} briefs
              </p>
              {previewM.data.skipped?.length ? (
                <p className="mt-1 text-xs text-ink-soft">Skipped rows: {previewM.data.skipped.length}</p>
              ) : null}
              <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs text-ink-soft">
                {previewM.data.sample.map((t: any, i: number) => (
                  <li key={i}>
                    <span className="text-foreground">{t.day_label}</span> · {t.start_time ?? "—"} ·{" "}
                    {t.department} · {t.task}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display text-base font-bold">Departments</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {(deptQ.data ?? []).map((d) => (
                <li key={d.id}>
                  <span className="font-medium text-foreground">{d.name}</span>
                  {d.lead_name ? ` · ${d.lead_name}` : ""}
                  {d.contact ? ` · ${d.contact}` : ""}
                </li>
              ))}
              {deptQ.data?.length === 0 ? <li>Nothing synced yet.</li> : null}
            </ul>
          </div>
        </section>
      ) : null}

      {tab === "suggestions" ? (
        <section className="mt-4 space-y-2">
          {(suggQ.data ?? []).map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">{s.item}</p>
              <p className="text-xs text-ink-soft">
                {deptName(s.department_id)} · {s.created_by_name ?? "Crew"} ·{" "}
                {new Date(s.created_at).toLocaleDateString()}
              </p>
              {s.notes ? <p className="mt-1 text-sm text-ink-soft">{s.notes}</p> : null}
              {s.status === "pending" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      decideM.mutate({
                        id: s.id,
                        approve: true,
                        departmentId: s.department_id,
                        item: s.item,
                        notes: s.notes,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <Check className="h-3.5 w-3.5" /> Add to list
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      decideM.mutate({
                        id: s.id,
                        approve: false,
                        departmentId: s.department_id,
                        item: s.item,
                        notes: s.notes,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs font-semibold capitalize text-ink-soft">{s.status}</p>
              )}
            </div>
          ))}
          {suggQ.data?.length === 0 ? (
            <p className="text-sm text-ink-soft">No suggestions from crew yet.</p>
          ) : null}
        </section>
      ) : null}

      {tab === "waivers" ? (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Signed waivers
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(waiverQ.data ?? []).map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-medium">{w.full_name}</span>
                  <span className="block text-xs text-ink-soft">{deptName(w.department_id)}</span>
                </span>
                <span className="text-xs text-ink-soft">
                  {new Date(w.accepted_at).toLocaleString()} · {w.waiver_version}
                </span>
              </li>
            ))}
            {waiverQ.data?.length === 0 ? <li className="text-ink-soft">Nobody has signed yet.</li> : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
