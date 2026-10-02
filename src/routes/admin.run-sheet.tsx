// Admin: link an event's master run sheet (Google Sheet), sync departments,
// daily instructions and packing lists, assign crew and review suggestions.
import { createFileRoute } from "@tanstack/react-router";
import { visibleInBackend } from "@/lib/event-window";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ClipboardList, Eye, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { previewRunSheet, syncRunSheet } from "@/lib/run-sheet.functions";

export const Route = createFileRoute("/admin/run-sheet")({
  validateSearch: (s: Record<string, unknown>): { event?: string } =>
    typeof s["event"] === "string" ? { event: s["event"] as string } : {},
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
  const { event: linkedEvent } = Route.useSearch();
  const [eventId, setEventId] = useState(linkedEvent ?? "");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const preview = useServerFn(previewRunSheet);
  const sync = useServerFn(syncRunSheet);

  const eventsQ = useQuery({
    queryKey: ["events-run-sheet"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, days, run_sheet_url, run_sheet_synced_at, run_sheet_error")
        .order("event_date", { ascending: false });
      return visibleInBackend((data ?? []) as {
        id: string;
        name: string;
        event_date: string;
        days?: unknown[];
        run_sheet_url: string | null;
        run_sheet_synced_at: string | null;
        run_sheet_error: string | null;
      }[]);
    },
  });
  const events = eventsQ.data ?? [];
  const event = events.find((e) => e.id === eventId);
  const otherLinked = events.filter((e) => e.id !== eventId && !!e.run_sheet_url);

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

  type TaskRow = {
    id: string;
    department_id: string;
    day_label: string;
    day_index: number;
    start_time: string | null;
    end_time: string | null;
    task: string;
    kind: string;
    detail: string | null;
    owner: string | null;
    location: string | null;
    notes: string | null;
    sort_order: number;
  };
  const tasksQ = useQuery({
    queryKey: ["admin-run-tasks", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("run_sheet_tasks")
        .select("id, department_id, day_label, day_index, start_time, end_time, task, kind, detail, owner, location, notes, sort_order")
        .eq("event_id", eventId)
        .order("day_index")
        .order("sort_order");
      return (data ?? []) as TaskRow[];
    },
  });
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ kind: "task", day_label: "", start_time: "", task: "", detail: "", owner: "", location: "" });

  const openTaskEdit = (t: TaskRow) => {
    setEditTask(t);
    setAddingFor(null);
    setTaskForm({
      kind: t.kind,
      day_label: t.day_label,
      start_time: t.start_time ?? "",
      task: t.task,
      detail: t.detail ?? "",
      owner: t.owner ?? "",
      location: t.location ?? "",
    });
  };
  const openTaskAdd = (deptId: string, kind = "task") => {
    setAddingFor(deptId);
    setEditTask(null);
    setTaskForm({ kind, day_label: "", start_time: "", task: "", detail: "", owner: "", location: "" });
  };

  const taskSaveM = useMutation({
    mutationFn: async () => {
      const isHeader = taskForm.kind === "header";
      const row = {
        kind: taskForm.kind,
        day_label: taskForm.day_label.trim() || "Day 1",
        start_time: isHeader ? null : taskForm.start_time.trim() || null,
        task: taskForm.task.trim(),
        detail: taskForm.detail.trim() || null,
        owner: isHeader ? null : taskForm.owner.trim() || null,
        location: isHeader ? null : taskForm.location.trim() || null,
      };
      if (!row.task) throw new Error(isHeader ? "Header text is required." : "Task text is required.");
      if (editTask) {
        const { error } = await supabase.from("run_sheet_tasks").update(row).eq("id", editTask.id);
        if (error) throw error;
      } else if (addingFor) {
        const maxDay = Math.max(0, ...(tasksQ.data ?? []).map((t) => t.day_index));
        const { error } = await supabase.from("run_sheet_tasks").insert({
          ...row,
          event_id: eventId,
          department_id: addingFor,
          day_index: maxDay || 1,
          sort_order: 999,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setMsg(editTask ? "Task updated." : "Task added.");
      setEditTask(null);
      setAddingFor(null);
      qc.invalidateQueries({ queryKey: ["admin-run-tasks", eventId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const taskDeleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("run_sheet_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg("Task deleted.");
      qc.invalidateQueries({ queryKey: ["admin-run-tasks", eventId] });
    },
    onError: (e: Error) => setMsg(e.message),
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
          event_id: eventId,
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
              Every tab is read. A tab needs a <strong>Task</strong> column, plus either a{" "}
              <strong>Department</strong> column or a tab named after the department. Tabs named{" "}
              <strong>Packing</strong> or <strong>Brief</strong> are treated as kit lists and role briefs.
              Share the sheet with anyone-with-link viewer access.
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              Saving links this sheet to <strong>{event?.name ?? "—"}</strong>.
            </p>
            {otherLinked.length ? (
              <p className="mt-1 text-xs text-amber-600">
                Also linked elsewhere: {otherLinked.map((e) => e.name).join(", ")}.
              </p>
            ) : null}

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
              {previewM.data.skipped ? (
                <p className="mt-1 text-xs text-ink-soft">Skipped rows: {previewM.data.skipped}</p>
              ) : null}
              <div className="mt-3 space-y-1 text-xs">
                {(previewM.data.tabs ?? []).map((t: any) => (
                  <div key={t.tab} className="rounded-lg border border-border px-2 py-1.5">
                    <p className="font-semibold text-foreground">
                      {t.tab} · {t.kind}
                      {t.headerRow ? ` · header row ${t.headerRow}` : " · no header found"}
                    </p>
                    <p className="text-ink-soft">
                      {t.used} used · {t.skipped} skipped
                      {t.unknownColumns?.length
                        ? ` · unrecognised columns: ${t.unknownColumns.join(", ")}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
              <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs text-ink-soft">
                {previewM.data.sample.map((t: any, i: number) => (
                  <li key={i}>
                    <span className="text-foreground">{t.day || "—"}</span> · {t.start || "—"} ·{" "}
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

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display text-base font-bold">Tasks</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Edit tasks here directly, or change the Google Sheet and sync again (a sync replaces these).
            </p>
            {(deptQ.data ?? []).map((d) => {
              const tasks = (tasksQ.data ?? []).filter((t) => t.department_id === d.id);
              return (
                <div key={d.id} className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{d.name}</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openTaskAdd(d.id, "header")}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold"
                      >
                        <Plus className="h-3 w-3" /> Add header
                      </button>
                      <button
                        type="button"
                        onClick={() => openTaskAdd(d.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold"
                      >
                        <Plus className="h-3 w-3" /> Add task
                      </button>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {tasks.map((t) => (
                      <li key={t.id} className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm ${t.kind === "header" ? "border border-primary/40 bg-primary/5" : "border border-border"}`}>
                        <div>
                          <p className={t.kind === "header" ? "font-display font-bold" : "font-medium"}>{t.task}</p>
                          <p className="text-xs text-ink-soft">
                            {t.day_label}
                            {t.start_time ? ` · ${t.start_time}` : ""}
                            {t.owner ? ` · ${t.owner}` : ""}
                            {t.location ? ` · ${t.location}` : ""}
                          </p>
                          {t.detail ? <p className="mt-0.5 text-xs text-ink-soft">{t.detail}</p> : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => openTaskEdit(t)} className="rounded-lg border border-border p-1.5" aria-label="Edit task">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (confirm(`Delete "${t.task}"?`)) taskDeleteM.mutate(t.id); }}
                            className="rounded-lg border border-border p-1.5 text-destructive"
                            aria-label="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                    {tasks.length === 0 ? <li className="text-xs text-ink-soft">No tasks yet.</li> : null}
                  </ul>
                </div>
              );
            })}

            {editTask || addingFor ? (
              <div className="mt-4 space-y-2 rounded-xl border border-primary/40 bg-background p-3">
                <p className="text-sm font-semibold">
                  {editTask ? (taskForm.kind === "header" ? "Edit header" : "Edit task") : taskForm.kind === "header" ? "New header" : "New task"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={taskForm.day_label}
                    onChange={(e) => setTaskForm({ ...taskForm, day_label: e.target.value })}
                    placeholder="Day (e.g. Build day 1)"
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                  {taskForm.kind !== "header" ? (
                    <input
                      value={taskForm.start_time}
                      onChange={(e) => setTaskForm({ ...taskForm, start_time: e.target.value })}
                      placeholder="Start time (e.g. 08:00)"
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    />
                  ) : null}
                </div>
                <input
                  value={taskForm.task}
                  onChange={(e) => setTaskForm({ ...taskForm, task: e.target.value })}
                  placeholder={taskForm.kind === "header" ? "Header (e.g. Tent build)" : "Task"}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
                <textarea
                  value={taskForm.detail}
                  onChange={(e) => setTaskForm({ ...taskForm, detail: e.target.value })}
                  placeholder={taskForm.kind === "header" ? "Detail under this header (optional)" : "Detail (optional)"}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
                {taskForm.kind !== "header" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={taskForm.owner}
                      onChange={(e) => setTaskForm({ ...taskForm, owner: e.target.value })}
                      placeholder="Owner (optional)"
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    />
                    <input
                      value={taskForm.location}
                      onChange={(e) => setTaskForm({ ...taskForm, location: e.target.value })}
                      placeholder="Location (optional)"
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => taskSaveM.mutate()}
                    disabled={taskSaveM.isPending}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {taskSaveM.isPending ? "Saving…" : editTask ? "Save changes" : taskForm.kind === "header" ? "Add header" : "Add task"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditTask(null); setAddingFor(null); }}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
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
