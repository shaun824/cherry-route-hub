// Crew Learn: the season calendar. Every event on our books for the year,
// straight from the Entry Ninja-synced event list, grouped month by month.
import { visibleInBackend } from "@/lib/event-window";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bike, CalendarDays, ChevronRight, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsCrew } from "@/lib/auth";

export const Route = createFileRoute("/crew/learn/calendar")({
  head: () => ({
    meta: [
      { title: "Season calendar · Red Cherry Crew" },
      {
        name: "description",
        content: "Every Red Cherry event for the year, month by month, so crew know how the season runs.",
      },
      { property: "og:title", content: "Season calendar · Red Cherry Crew" },
      { property: "og:description", content: "The full year of Red Cherry events at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SeasonCalendar,
});

type CalEvent = {
  id: string;
  name: string;
  event_date: string;
  location: string | null;
  discipline: string | null;
  lifecycle: string | null;
  status: string | null;
  days: unknown[] | null;
  entry_ninja_url: string | null;
};

async function fetchCalendarEvents(): Promise<CalEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, event_date, location, discipline, lifecycle, status, days, entry_ninja_url")
    .neq("lifecycle", "draft")
    .order("event_date", { ascending: true });
  if (error) {
    console.warn("[crew calendar]", error);
    return [];
  }
  return visibleInBackend((data ?? []) as CalEvent[]);
}

/** Event id -> published training course id, so calendar rows can open Learn. */
async function fetchEventCourses(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("learn_courses")
    .select("id, event_id, status")
    .eq("kind", "event")
    .eq("status", "published");
  if (error) {
    console.warn("[crew calendar courses]", error);
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const eid = (row as { event_id: string | null }).event_id;
    if (eid && !out[eid]) out[eid] = String((row as { id: string }).id);
  }
  return out;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dayCount(days: unknown): number {
  if (Array.isArray(days)) return days.length;
  return 0;
}

// event_date may be a plain date ("2026-02-19") or a timestamp — parse both.
function toDate(value: string): Date {
  const iso = String(value).slice(0, 10);
  return new Date(`${iso}T00:00:00`);
}

function dateRange(iso: string, nDays: number) {
  const start = toDate(iso);
  if (nDays <= 1) return start.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const end = new Date(start);
  end.setDate(end.getDate() + nDays - 1);
  const sameMonth = start.getMonth() === end.getMonth();
  return `${start.getDate()}${sameMonth ? "" : ` ${start.toLocaleDateString(undefined, { month: "short" })}`}–${end.getDate()} ${end.toLocaleDateString(
    undefined,
    { month: "short" },
  )}`;
}

function SeasonCalendar() {
  const { isCrew, loading } = useIsCrew();
  const eventsQ = useQuery({ queryKey: ["crew-season-calendar"], queryFn: fetchCalendarEvents, enabled: isCrew });
  const coursesQ = useQuery({ queryKey: ["crew-season-courses"], queryFn: fetchEventCourses, enabled: isCrew });
  const courseByEvent = coursesQ.data ?? {};
  const [year, setYear] = useState<number>(new Date().getFullYear());


  const events = eventsQ.data ?? [];
  const years = useMemo(() => {
    const set = new Set<number>(
      events.map((e) => toDate(e.event_date).getFullYear()).filter((y) => Number.isFinite(y)),
    );
    set.add(new Date().getFullYear());
    return Array.from(set).sort();
  }, [events]);

  const byMonth = useMemo(() => {
    const out: CalEvent[][] = Array.from({ length: 12 }, () => []);
    for (const e of events) {
      const d = toDate(e.event_date);
      if (d.getFullYear() !== year) continue;
      out[d.getMonth()]!.push(e);
    }
    return out;
  }, [events, year]);


  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (!isCrew) return <Navigate to="/crew/login" />;

  const total = byMonth.reduce((n, m) => n + m.length, 0);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <Link to="/crew/learn" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
        <ArrowLeft className="h-4 w-4" /> Learn
      </Link>

      <header className="mt-3 flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Season calendar {year}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every event on our books for {year} — {total} event{total === 1 ? "" : "s"}. This is how our year runs, so
            you know what's coming and when the busy blocks are.
          </p>
        </div>
      </header>

      {/* Sticky so the year you're viewing stays visible as you scroll the months. */}
      <div className="sticky top-0 z-20 -mx-4 mt-4 border-b border-line bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-soft">Year</span>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              aria-pressed={y === year}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                y === year ? "bg-brand text-white shadow-sm" : "border border-line text-ink"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>


      {eventsQ.isLoading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        </div>
      ) : !total ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          No events on the calendar for {year} yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {byMonth.map((items, i) =>
            items.length ? (
              <section key={MONTHS[i]}>
                <h2 className="font-display text-lg font-bold">{MONTHS[i]}</h2>
                <ul className="mt-2 space-y-2">
                  {items.map((e) => {
                    const n = dayCount(e.days);
                    const past = e.event_date < todayIso;
                    const courseId = courseByEvent[e.id];
                    const body = (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{e.name}</p>
                            <p className="mt-0.5 text-sm text-ink-soft">
                              {dateRange(e.event_date, n)}
                              {n > 1 ? ` · ${n} days` : ""}
                            </p>
                            {e.location ? (
                              <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft">
                                <MapPin className="h-3.5 w-3.5" /> {e.location}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {e.discipline ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs text-ink-soft">
                                <Bike className="h-3.5 w-3.5" /> {e.discipline}
                              </span>
                            ) : null}
                            {e.lifecycle && e.lifecycle !== "archived" && !past ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                                Entries {e.status === "closed" ? "closed" : "open"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                          {courseId ? "Open event training" : "No training built yet"}
                          {courseId ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                        </p>
                      </>
                    );
                    const cls = `block rounded-2xl border border-line bg-card p-4 text-left ${past ? "opacity-60" : ""}`;
                    return (
                      <li key={e.id}>
                        {courseId ? (
                          <Link to="/crew/learn/$courseId" params={{ courseId }} className={cls}>
                            {body}
                          </Link>
                        ) : (
                          <div className={cls}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
