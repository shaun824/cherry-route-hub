// Admin: build and refresh the crew training courses. Content is generated
// from the app's own data (events, schedules, venues, run sheets, knowledge).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, GraduationCap, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchDepartments } from "@/lib/run-sheet";
import { fetchLearnCourses, COURSE_KIND_LABEL, type LearnCourse } from "@/lib/learn";
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
    .select("id, name, event_date")
    .order("event_date", { ascending: false });
  return (data ?? []) as { id: string; name: string; event_date: string }[];
}

function AdminLearn() {
  const qc = useQueryClient();
  const generate = useServerFn(generateLearnCourse);
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
        <h2 className="font-display text-lg font-bold">{COURSE_KIND_LABEL.event}</h2>
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
    </div>
  );
}
