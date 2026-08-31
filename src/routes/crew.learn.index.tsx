// Crew Learn: the training library. Lists the courses built from our live
// event data — the business, the event, and your department.
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Loader2, Building2, CalendarDays, HardHat, CheckCircle2 } from "lucide-react";
import { useIsCrew } from "@/lib/auth";
import { fetchCrewEvents } from "@/lib/crew";
import { useCrewEvent } from "@/lib/crew-event";
import {
  COURSE_KIND_BLURB,
  COURSE_KIND_LABEL,
  fetchCompletions,
  fetchLearnCourses,
  fetchOpenEventIds,
  type LearnCourse,
  type LearnCourseKind,
} from "@/lib/learn";

export const Route = createFileRoute("/crew/learn/")({
  head: () => ({
    meta: [
      { title: "Learn · Red Cherry Crew" },
      {
        name: "description",
        content: "Staff training built from Red Cherry's live event data: the business, each event, and your department.",
      },
      { property: "og:title", content: "Learn · Red Cherry Crew" },
      { property: "og:description", content: "Train new crew on how our events actually run." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LearnIndex,
});

const KIND_ICON: Record<LearnCourseKind, typeof Building2> = {
  business: Building2,
  event: CalendarDays,
  department: HardHat,
};

function LearnIndex() {
  const { isCrew, loading, user } = useIsCrew();

  const coursesQ = useQuery({ queryKey: ["learn-courses"], queryFn: fetchLearnCourses, enabled: isCrew });
  const eventsQ = useQuery({ queryKey: ["crew-events"], queryFn: fetchCrewEvents, enabled: isCrew });
  const openQ = useQuery({ queryKey: ["learn-open-events"], queryFn: fetchOpenEventIds, enabled: isCrew });
  const crewEvents = eventsQ.data ?? [];
  const [crewEventId] = useCrewEvent(crewEvents);
  const doneQ = useQuery({
    queryKey: ["learn-completions", user?.id],
    enabled: isCrew && !!user,
    queryFn: () => fetchCompletions(user!.id),
  });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (!isCrew) return <Navigate to="/crew/login" />;

  // Only the events we're currently open for appear in the library.
  const openIds = openQ.data;
  const courses = (coursesQ.data ?? []).filter((c) => {
    if (c.status !== "published") return false;
    if (!c.event_id) return true;
    return openIds ? openIds.has(c.event_id) : true;
  });
  const eventName = new Map((eventsQ.data ?? []).map((e) => [e.id, e.name]));
  const completions = doneQ.data ?? {};

  // Your event first, then everything else so you can widen your knowledge.
  const byChosenEventFirst = (a: LearnCourse, b: LearnCourse) => {
    const rank = (c: LearnCourse) => (crewEventId && c.event_id === crewEventId ? 0 : 1);
    return rank(a) - rank(b);
  };
  const groups: { kind: LearnCourseKind; items: LearnCourse[] }[] = (
    ["business", "event", "department"] as LearnCourseKind[]
  ).map((kind) => ({
    kind,
    items: courses.filter((c) => c.kind === kind).sort(byChosenEventFirst),
  }));
  const chosenEventName = crewEventId ? eventName.get(crewEventId) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Crew tools</p>
          <h1 className="font-display text-2xl font-bold">Learn</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Everything a new team member needs, built from the real event data in this app.
          </p>
          {chosenEventName ? (
            <p className="mt-1 text-xs text-ink-soft">
              Starting with <span className="font-semibold text-ink">{chosenEventName}</span> — the event you
              picked on the crew dashboard.
            </p>
          ) : null}
        </div>
      </header>

      <Link
        to="/crew/learn/calendar"
        className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-brand/40"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <CalendarDays className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-ink">Season calendar</span>
          <span className="block text-sm text-ink-soft">
            Our full year of events, month by month, so you can see how the schedule runs.
          </span>
        </span>
      </Link>

      {coursesQ.isLoading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        </div>
      ) : !courses.length ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          No training courses have been built yet. An admin can generate them from{" "}
          <span className="font-semibold text-ink">Admin → Crew training</span>.
        </div>
      ) : (
        <div className="mt-6 space-y-7">
          {groups.map((g) => {
            const Icon = KIND_ICON[g.kind];
            if (!g.items.length) return null;
            return (
              <section key={g.kind}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand" />
                  <h2 className="font-display text-lg font-bold">{COURSE_KIND_LABEL[g.kind]}</h2>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">{COURSE_KIND_BLURB[g.kind]}</p>
                <ul className="mt-3 space-y-2">
                  {g.items.map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/crew/learn/$courseId"
                        params={{ courseId: c.id }}
                        className="block rounded-2xl border border-line bg-card p-4 transition hover:border-brand/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{c.title}</p>
                            {c.summary ? <p className="mt-0.5 text-sm text-ink-soft">{c.summary}</p> : null}
                            {c.event_id && eventName.get(c.event_id) ? (
                              <p className="mt-1 text-xs text-ink-soft">
                                {eventName.get(c.event_id)}
                                {crewEventId && c.event_id === crewEventId ? (
                                  <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                                    Your event
                                  </span>
                                ) : null}
                              </p>
                            ) : null}
                          </div>
                          {completions[c.id] ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
