// Admin: build and refresh the crew training courses. Content is generated
// from the app's own data (events, schedules, venues, run sheets, knowledge).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, GraduationCap, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchDepartments } from "@/lib/run-sheet";
import {
  fetchLearnCourses,
  fetchLearnResults,
  COURSE_KIND_LABEL,
  QUIZ_PASS_RATIO,
  type LearnCourse,
  type LearnResultPerson,
} from "@/lib/learn";
import { generateLearnCourse, syncOpenEventLearning } from "@/lib/learn.functions";

export const Route = createFileRoute("/admin/learn")({
  head: () => ({
    meta: [
      { title: "Crew training · Red Cherry admin" },
      { name: "description", content: "Generate and refresh the staff training courses crew work through in the app." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLearn,
});

async function fetchEvents() {
  const { data } = await supabase
    .from("events")
    .select("id, name, event_date, days")
    .order("event_date", { ascending: false });
  return visibleInBackend((data ?? []) as { id: string; name: string; event_date: string; days?: unknown[] }[]);
}


function ScoreBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-ink-soft">No quiz yet</span>;
  const pass = pct >= QUIZ_PASS_RATIO * 100;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        pass ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {pct}%
    </span>
  );
}

function StaffResults() {
  const q = useQuery({ queryKey: ["learn-results"], queryFn: fetchLearnResults });
  const [open, setOpen] = useState<string | null>(null);
  const people = (q.data ?? []) as LearnResultPerson[];

  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />;
  if (!people.length) {
    return <p className="text-sm text-ink-soft">Nobody has started a course yet. Results appear here as crew work through the training.</p>;
  }

  return (
    <div className="space-y-2">
      {people.map((p) => (
        <div key={p.userId} className="rounded-2xl border border-line bg-card">
          <button
            type="button"
            onClick={() => setOpen(open === p.userId ? null : p.userId)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{p.name}</p>
              <p className="truncate text-xs text-ink-soft">
                {p.overallPct}% of lessons · {p.coursesCompleted} course{p.coursesCompleted === 1 ? "" : "s"} finished
                {p.lastActive ? ` · last active ${new Date(p.lastActive).toLocaleDateString()}` : ""}
              </p>
            </div>
            <div className="shrink-0">
              <ScoreBadge pct={p.scorePct} />
            </div>
          </button>
          {open === p.userId ? (
            <div className="space-y-2 border-t border-line p-4">
              {p.email ? <p className="text-xs text-ink-soft">{p.email}</p> : null}
              {p.courses.map((c) => (
                <div key={c.courseId} className="rounded-xl bg-surface px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-ink">{c.courseTitle}</p>
                    <ScoreBadge pct={c.scorePct} />
                  </div>
                  <p className="text-xs text-ink-soft">
                    {c.lessonsDone}/{c.lessonsTotal} lessons · {c.quizzesPassed}/{c.quizzesTaken} quizzes passed
                    {c.completedAt ? ` · completed ${new Date(c.completedAt).toLocaleDateString()}` : ""}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function AdminLearn() {
  const qc = useQueryClient();
  const generate = useServerFn(generateLearnCourse);
  const syncOpen = useServerFn(syncOpenEventLearning);
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const eventsQ = useQuery({ queryKey: ["admin-learn-events"], queryFn: fetchEvents });
  const coursesQ = useQuery({ queryKey: ["learn-courses"], queryFn: fetchLearnCourses });
  const deptQ = useQuery({
    queryKey: ["admin-learn-depts", eventId],
    enabled: !!eventId,
    queryFn: () => fetchDepartments(eventId),
  });

  const events = eventsQ.data ?? [];
  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0].id);
  }, [events, eventId]);

  const courses = coursesQ.data ?? [];
  const find = (kind: string, evId?: string, deptId?: string): LearnCourse | undefined =>
    courses.find(
      (c) => c.kind === kind && (c.event_id ?? undefined) === evId && (c.department_id ?? undefined) === deptId,
    );

  async function run(
    key: string,
    input: { kind: "business" | "event" | "department"; eventId?: string; departmentId?: string },
  ) {
    setBusy(key);
    setMessage(null);
    try {
      const res = (await generate({ data: input })) as { modules: number };
      setMessage({ ok: true, text: `Course built — ${res.modules} modules.` });
      qc.invalidateQueries({ queryKey: ["learn-courses"] });
      qc.invalidateQueries({ queryKey: ["learn-modules"] });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not build that course." });
    } finally {
      setBusy(null);
    }
  }

  function Status({ course }: { course?: LearnCourse }) {
    if (!course) return <span className="text-xs text-ink-soft">Not built yet</span>;
    if (course.generation_error) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" /> {course.generation_error}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Built {course.generated_at ? new Date(course.generated_at).toLocaleString() : ""}
      </span>
    );
  }

  function Row({
    title,
    subtitle,
    course,
    onRun,
    busyKey,
  }: {
    title: string;
    subtitle?: string;
    course?: LearnCourse;
    onRun: () => void;
    busyKey: string;
  }) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{title}</p>
          {subtitle ? <p className="truncate text-sm text-ink-soft">{subtitle}</p> : null}
          <div className="mt-1">
            <Status course={course} />
          </div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={busy !== null}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === busyKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {course ? "Rebuild" : "Build"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Crew training</h1>
          <p className="text-sm text-ink-soft">
            Courses are written from the data already in this app — events, schedules, venues, run sheets, packing
            lists and the bot knowledge base. Rebuild a course whenever that data changes.
          </p>
        </div>
      </header>

      {message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">{COURSE_KIND_LABEL.business}</h2>
        <Row
          title="How Red Cherry works"
          subtitle="Our events, the rider journey, communication, sponsors, loyalty and the marketing clients we look after."
          course={find("business")}
          busyKey="business"
          onRun={() => run("business", { kind: "business" })}
        />
        <p className="text-xs text-ink-soft">
          The marketing-client detail comes from internal notes in{" "}
          <span className="font-semibold">Bot knowledge</span> — add a note per retainer client (deliverables, posting
          cadence, approval process, tone) and rebuild.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{COURSE_KIND_LABEL.event}</h2>
            <p className="text-xs text-ink-soft">
              Crew only see courses for the events we're currently open for. This refreshes weekly on its own.
            </p>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("open-sync");
              setMessage(null);
              try {
                const res = (await syncOpen({ data: { force: true } })) as {
                  open: number;
                  built: string[];
                  hidden: number;
                  failed: { event: string; error: string }[];
                };
                setMessage({
                  ok: !res.failed.length,
                  text: `${res.open} open event${res.open === 1 ? "" : "s"} · ${res.built.length} rebuilt · ${res.hidden} hidden${
                    res.failed.length ? ` · failed: ${res.failed.map((f) => f.event).join(", ")}` : ""
                  }`,
                });
                qc.invalidateQueries({ queryKey: ["learn-courses"] });
                qc.invalidateQueries({ queryKey: ["learn-modules"] });
              } catch (e) {
                setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not refresh open events." });
              } finally {
                setBusy(null);
              }
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {busy === "open-sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh open events
          </button>
        </div>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {eventId ? (
          <Row
            title={events.find((e) => e.id === eventId)?.name ?? "Event"}
            subtitle="Schedule, registration, race village, accommodation, routes and the rider experience."
            course={find("event", eventId)}
            busyKey={`event:${eventId}`}
            onRun={() => run(`event:${eventId}`, { kind: "event", eventId })}
          />
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">{COURSE_KIND_LABEL.department}</h2>
        {deptQ.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        ) : !(deptQ.data ?? []).length ? (
          <p className="text-sm text-ink-soft">
            This event has no departments yet — sync its run sheet first under <span className="font-semibold">Run sheets</span>.
          </p>
        ) : (
          <div className="space-y-2">
            {(deptQ.data ?? []).map((d) => (
              <Row
                key={d.id}
                title={d.name}
                subtitle="Brief, run sheet, packing list, safety and handovers."
                course={find("department", eventId, d.id)}
                busyKey={`dept:${d.id}`}
                onRun={() => run(`dept:${d.id}`, { kind: "department", departmentId: d.id })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">Staff results</h2>
        <p className="text-xs text-ink-soft">
          Every person who has started the training, how far they've got and their best quiz score per course. Tap a
          name for the breakdown. Pass mark is {Math.round(QUIZ_PASS_RATIO * 100)}%.
        </p>
        <StaffResults />
      </section>
    </div>
  );
}
