// Crew run sheet: every department's instructions for the event, by day,
// with personal tick-off and quick links into department onboarding.
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, HardHat, Loader2 } from "lucide-react";
import { useIsCrew } from "@/lib/auth";
import { useCrewEvent, useCrewShowPast } from "@/lib/crew-event";
import { fetchAllCrewEvents, fetchCrewEvents } from "@/lib/crew";
import {
  fetchDepartments,
  fetchMyDepartmentIds,
  fetchMyTaskState,
  fetchRunSheetTasks,
  groupTasksByDay,
  setTaskDone,
} from "@/lib/run-sheet";

export const Route = createFileRoute("/crew/run-sheet")({
  head: () => ({
    meta: [
      { title: "Run sheet · Red Cherry Crew" },
      {
        name: "description",
        content:
          "The full Red Cherry event run sheet by day and department, with tick-off for the jobs you're responsible for.",
      },
      { property: "og:title", content: "Run sheet · Red Cherry Crew" },
      {
        property: "og:description",
        content: "Daily instructions for every department, on your phone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RunSheetPage,
});

function RunSheetPage() {
  const { isCrew, loading, user } = useIsCrew();
  const qc = useQueryClient();
  const [dayKey, setDayKey] = useState("");
  const [mineOnly, setMineOnly] = useState(true);

  const [showPast] = useCrewShowPast();
  const eventsQ = useQuery({
    queryKey: ["crew-events", showPast ? "all" : "visible"],
    queryFn: showPast ? fetchAllCrewEvents : fetchCrewEvents,
    enabled: isCrew,
  });
  const events = eventsQ.data ?? [];
  const [eventId, setEventId] = useCrewEvent(events);

  const deptQ = useQuery({
    queryKey: ["crew-departments", eventId],
    enabled: isCrew && !!eventId,
    queryFn: () => fetchDepartments(eventId),
  });
  const mineQ = useQuery({
    queryKey: ["crew-my-depts", eventId],
    enabled: isCrew && !!eventId,
    queryFn: () => fetchMyDepartmentIds(eventId),
  });
  const tasksQ = useQuery({
    queryKey: ["crew-run-sheet", eventId],
    enabled: isCrew && !!eventId,
    queryFn: () => fetchRunSheetTasks(eventId),
  });
  const stateQ = useQuery({
    queryKey: ["crew-task-state"],
    enabled: isCrew,
    queryFn: fetchMyTaskState,
  });

  const myDepts = mineQ.data ?? [];
  const tasks = useMemo(() => {
    const all = tasksQ.data ?? [];
    return mineOnly && myDepts.length ? all.filter((t) => myDepts.includes(t.department_id)) : all;
  }, [tasksQ.data, mineOnly, myDepts]);

  const days = useMemo(() => groupTasksByDay(tasks), [tasks]);
  useEffect(() => {
    if (!days.length) return;
    if (!days.some((d) => d.key === dayKey)) setDayKey(days[0].key);
  }, [days, dayKey]);

  const deptName = useMemo(() => {
    const m = new Map((deptQ.data ?? []).map((d) => [d.id, d.name]));
    return (id: string) => m.get(id) ?? "Department";
  }, [deptQ.data]);

  async function toggle(taskId: string, done: boolean) {
    if (!user) return;
    await setTaskDone(user.id, taskId, done);
    qc.setQueryData<Record<string, boolean>>(["crew-task-state"], (prev) => ({
      ...(prev ?? {}),
      [taskId]: done,
    }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (!isCrew) return <Navigate to="/crew/login" />;

  const day = days.find((d) => d.key === dayKey) ?? days[0];
  const state = stateQ.data ?? {};

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Crew tools</p>
        <h1 className="font-display text-2xl font-bold">Run sheet</h1>
      </header>

      {events.length > 1 ? (
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      ) : null}

      <section className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Departments</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(deptQ.data ?? []).map((d) => (
            <Link
              key={d.id}
              to="/crew/department/$deptId"
              params={{ deptId: d.id }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                myDepts.includes(d.id)
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-ink-soft"
              }`}
            >
              <HardHat className="h-3.5 w-3.5" />
              {d.name}
            </Link>
          ))}
          {deptQ.data?.length === 0 ? (
            <p className="text-sm text-ink-soft">No departments synced for this event yet.</p>
          ) : null}
        </div>
      </section>

      {myDepts.length ? (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="h-4 w-4"
          />
          Only my departments
        </label>
      ) : null}

      {days.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDayKey(d.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                d.key === (day?.key ?? "")
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-ink-soft"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      ) : null}

      {tasksQ.isLoading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        </div>
      ) : null}

      {!tasksQ.isLoading && !day ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm text-ink-soft">
          <ClipboardList className="mb-2 h-5 w-5" />
          No run sheet has been synced for this event yet.
        </div>
      ) : null}

      {day ? (
        <ul className="mt-4 space-y-3">
          {day.tasks.map((t) => (
            <li key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={!!state[t.id]}
                  onChange={(e) => toggle(t.id, e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-primary">
                    {[t.start_time, t.end_time].filter(Boolean).join(" – ") || "Anytime"} ·{" "}
                    {deptName(t.department_id)}
                  </p>
                  <p className={`text-sm font-semibold ${state[t.id] ? "text-ink-soft line-through" : ""}`}>
                    {t.task}
                  </p>
                  {t.detail ? <p className="mt-0.5 text-sm text-ink-soft">{t.detail}</p> : null}
                  {t.owner || t.location ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      {[t.owner, t.location].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {t.notes ? <p className="mt-1 text-xs text-ink-soft">{t.notes}</p> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
