// Crew Learn: staff training courses built from the app's own event data.
// Shared types plus the client-side reads used by the crew and admin screens.
import { supabase } from "@/integrations/supabase/client";

export type LearnCourseKind = "business" | "event" | "department";

export type LearnCourse = {
  id: string;
  kind: LearnCourseKind;
  event_id: string | null;
  department_id: string | null;
  title: string;
  summary: string | null;
  status: "draft" | "published";
  sort_order: number;
  generated_at: string | null;
  generation_error: string | null;
};

export type LearnLesson = {
  id: string;
  module_id: string;
  title: string;
  body: string;
  why_it_matters: string | null;
  sources: string[];
  sort_order: number;
  hidden: boolean;
};

export type LearnQuizQuestion = {
  id: string;
  module_id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  sort_order: number;
};

export type LearnModule = {
  id: string;
  course_id: string;
  title: string;
  summary: string | null;
  sort_order: number;
  hidden: boolean;
  lessons: LearnLesson[];
  questions: LearnQuizQuestion[];
};

export const COURSE_KIND_LABEL: Record<LearnCourseKind, string> = {
  business: "The business",
  event: "This event",
  department: "Your department",
};

export const COURSE_KIND_BLURB: Record<LearnCourseKind, string> = {
  business: "How Red Cherry runs events end to end, plus the marketing clients we look after.",
  event: "Everything about one event: schedule, venues, accommodation, routes and the rider journey.",
  department: "Your department's brief, hour-by-hour tasks, packing list and safety rules.",
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

export async function fetchLearnCourses(): Promise<LearnCourse[]> {
  const { data, error } = await supabase
    .from("learn_courses")
    .select("id, kind, event_id, department_id, title, summary, status, sort_order, generated_at, generation_error")
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[learn] courses", error);
    return [];
  }
  return (data ?? []) as LearnCourse[];
}

export async function fetchLearnCourse(courseId: string): Promise<LearnCourse | null> {
  const { data } = await supabase
    .from("learn_courses")
    .select("id, kind, event_id, department_id, title, summary, status, sort_order, generated_at, generation_error")
    .eq("id", courseId)
    .maybeSingle();
  return (data as LearnCourse) ?? null;
}

export async function fetchLearnModules(courseId: string): Promise<LearnModule[]> {
  const { data: mods, error } = await supabase
    .from("learn_modules")
    .select("id, course_id, title, summary, sort_order, hidden")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[learn] modules", error);
    return [];
  }
  const ids = (mods ?? []).map((m) => m.id);
  if (!ids.length) return [];

  const [{ data: lessons }, { data: questions }] = await Promise.all([
    supabase
      .from("learn_lessons")
      .select("id, module_id, title, body, why_it_matters, sources, sort_order, hidden")
      .in("module_id", ids)
      .order("sort_order", { ascending: true }),
    supabase
      .from("learn_quiz_questions")
      .select("id, module_id, question, options, correct_index, explanation, sort_order")
      .in("module_id", ids)
      .order("sort_order", { ascending: true }),
  ]);

  return (mods ?? []).map((m) => ({
    ...(m as Omit<LearnModule, "lessons" | "questions">),
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id && !l.hidden)
      .map((l) => ({ ...l, sources: asStringArray(l.sources) })) as LearnLesson[],
    questions: (questions ?? [])
      .filter((q) => q.module_id === m.id)
      .map((q) => ({ ...q, options: asStringArray(q.options) })) as LearnQuizQuestion[],
  }));
}

/** Lesson ids this user has ticked off. */
export async function fetchLearnProgress(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("learn_progress").select("lesson_id, done").eq("user_id", userId);
  return new Set((data ?? []).filter((r) => r.done).map((r) => r.lesson_id as string));
}

export async function setLessonDone(userId: string, lessonId: string, done: boolean) {
  const { error } = await supabase
    .from("learn_progress")
    .upsert({ user_id: userId, lesson_id: lessonId, done }, { onConflict: "user_id,lesson_id" });
  if (error) throw new Error(error.message);
}

export async function recordQuizAttempt(
  userId: string,
  moduleId: string,
  score: number,
  total: number,
  passed: boolean,
) {
  await supabase.from("learn_quiz_attempts").insert({ user_id: userId, module_id: moduleId, score, total, passed });
}

export async function fetchQuizAttempts(userId: string): Promise<
  { module_id: string; score: number; total: number; passed: boolean; created_at: string }[]
> {
  const { data } = await supabase
    .from("learn_quiz_attempts")
    .select("module_id, score, total, passed, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as never;
}

export async function markCourseComplete(userId: string, courseId: string) {
  await supabase
    .from("learn_completions")
    .upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id" });
}

export async function fetchCompletions(userId: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("learn_completions")
    .select("course_id, completed_at")
    .eq("user_id", userId);
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.course_id as string] = r.completed_at as string;
  return out;
}

/** Pass mark for a module quiz. */
export const QUIZ_PASS_RATIO = 0.7;

export function quizPassed(score: number, total: number) {
  if (!total) return true;
  return score / total >= QUIZ_PASS_RATIO;
}

export function courseProgress(modules: LearnModule[], done: Set<string>) {
  const lessons = modules.flatMap((m) => m.lessons);
  const doneCount = lessons.filter((l) => done.has(l.id)).length;
  return { total: lessons.length, done: doneCount, pct: lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0 };
}

/** Events we're currently open for — drives which "This event" courses show. */
export async function fetchOpenEventIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("events")
    .select("id, event_date, lifecycle, status")
    .neq("lifecycle", "archived")
    .neq("lifecycle", "draft");
  if (error) {
    console.warn("[learn] open events", error);
    return new Set();
  }
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return new Set(
    (data ?? [])
      .filter((e: any) => e.status !== "archived" && e.status !== "completed")
      .filter((e: any) => !e.event_date || new Date(e.event_date).getTime() >= cutoff)
      .map((e: any) => e.id as string),
  );
}

/* ---------------------------------------------------------------------------
 * Admin: who has done what. Admin RLS policies allow reading every row of
 * learn_progress / learn_quiz_attempts / learn_completions.
 * ------------------------------------------------------------------------ */

export type LearnResultCourse = {
  courseId: string;
  courseTitle: string;
  lessonsTotal: number;
  lessonsDone: number;
  pct: number;
  quizzesPassed: number;
  quizzesTaken: number;
  scorePct: number | null;
  completedAt: string | null;
};

export type LearnResultPerson = {
  userId: string;
  name: string;
  email: string | null;
  lastActive: string | null;
  overallPct: number;
  scorePct: number | null;
  coursesCompleted: number;
  courses: LearnResultCourse[];
};

export async function fetchLearnResults(): Promise<LearnResultPerson[]> {
  const [{ data: courses }, { data: modules }, { data: lessons }, { data: progress }, { data: attempts }, { data: completions }] =
    await Promise.all([
      supabase.from("learn_courses").select("id, title, status"),
      supabase.from("learn_modules").select("id, course_id, hidden"),
      supabase.from("learn_lessons").select("id, module_id, hidden"),
      supabase.from("learn_progress").select("user_id, lesson_id, done, updated_at"),
      supabase.from("learn_quiz_attempts").select("user_id, module_id, score, total, passed, created_at"),
      supabase.from("learn_completions").select("user_id, course_id, completed_at"),
    ]);

  const courseTitle = new Map<string, string>((courses ?? []).map((c) => [c.id as string, c.title as string]));
  const moduleCourse = new Map<string, string>(
    (modules ?? []).filter((m) => !m.hidden).map((m) => [m.id as string, m.course_id as string]),
  );
  const lessonCourse = new Map<string, string>();
  const lessonsPerCourse = new Map<string, number>();
  for (const l of lessons ?? []) {
    if (l.hidden) continue;
    const courseId = moduleCourse.get(l.module_id as string);
    if (!courseId) continue;
    lessonCourse.set(l.id as string, courseId);
    lessonsPerCourse.set(courseId, (lessonsPerCourse.get(courseId) ?? 0) + 1);
  }

  const userIds = new Set<string>();
  for (const r of progress ?? []) userIds.add(r.user_id as string);
  for (const r of attempts ?? []) userIds.add(r.user_id as string);
  for (const r of completions ?? []) userIds.add(r.user_id as string);
  if (!userIds.size) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", Array.from(userIds));
  const profile = new Map<string, { full_name: string | null; email: string | null }>(
    (profiles ?? []).map((p) => [p.id as string, { full_name: p.full_name as string | null, email: p.email as string | null }]),
  );

  type Acc = {
    done: Map<string, number>;
    best: Map<string, { score: number; total: number; passed: boolean }>; // per module
    completed: Map<string, string>;
    last: string | null;
  };
  const byUser = new Map<string, Acc>();
  const acc = (id: string): Acc => {
    let a = byUser.get(id);
    if (!a) {
      a = { done: new Map(), best: new Map(), completed: new Map(), last: null };
      byUser.set(id, a);
    }
    return a;
  };
  const bump = (a: Acc, ts: string | null | undefined) => {
    if (ts && (!a.last || ts > a.last)) a.last = ts;
  };

  for (const r of progress ?? []) {
    const a = acc(r.user_id as string);
    bump(a, r.updated_at as string | null);
    if (!r.done) continue;
    const courseId = lessonCourse.get(r.lesson_id as string);
    if (!courseId) continue;
    a.done.set(courseId, (a.done.get(courseId) ?? 0) + 1);
  }
  for (const r of attempts ?? []) {
    const a = acc(r.user_id as string);
    bump(a, r.created_at as string | null);
    const key = r.module_id as string;
    const prev = a.best.get(key);
    const ratio = (r.total as number) ? (r.score as number) / (r.total as number) : 0;
    const prevRatio = prev && prev.total ? prev.score / prev.total : -1;
    if (!prev || ratio > prevRatio) {
      a.best.set(key, { score: r.score as number, total: r.total as number, passed: !!r.passed });
    }
  }
  for (const r of completions ?? []) {
    const a = acc(r.user_id as string);
    bump(a, r.completed_at as string | null);
    a.completed.set(r.course_id as string, r.completed_at as string);
  }

  const rows: LearnResultPerson[] = [];
  for (const [userId, a] of byUser) {
    const touched = new Set<string>([...a.done.keys(), ...a.completed.keys()]);
    for (const moduleId of a.best.keys()) {
      const courseId = moduleCourse.get(moduleId);
      if (courseId) touched.add(courseId);
    }

    const courseRows: LearnResultCourse[] = [];
    let scoreSum = 0;
    let scoreTotal = 0;
    let lessonsDoneAll = 0;
    let lessonsTotalAll = 0;

    for (const courseId of touched) {
      const lessonsTotal = lessonsPerCourse.get(courseId) ?? 0;
      const lessonsDone = Math.min(a.done.get(courseId) ?? 0, lessonsTotal || Number.MAX_SAFE_INTEGER);
      let s = 0;
      let t = 0;
      let taken = 0;
      let passed = 0;
      for (const [moduleId, best] of a.best) {
        if (moduleCourse.get(moduleId) !== courseId) continue;
        s += best.score;
        t += best.total;
        taken += 1;
        if (best.passed) passed += 1;
      }
      scoreSum += s;
      scoreTotal += t;
      lessonsDoneAll += lessonsDone;
      lessonsTotalAll += lessonsTotal;
      courseRows.push({
        courseId,
        courseTitle: courseTitle.get(courseId) ?? "Course",
        lessonsTotal,
        lessonsDone,
        pct: lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0,
        quizzesPassed: passed,
        quizzesTaken: taken,
        scorePct: t ? Math.round((s / t) * 100) : null,
        completedAt: a.completed.get(courseId) ?? null,
      });
    }

    courseRows.sort((x, y) => y.pct - x.pct || x.courseTitle.localeCompare(y.courseTitle));
    const p = profile.get(userId);
    rows.push({
      userId,
      name: p?.full_name || p?.email || "Unknown user",
      email: p?.email ?? null,
      lastActive: a.last,
      overallPct: lessonsTotalAll ? Math.round((lessonsDoneAll / lessonsTotalAll) * 100) : 0,
      scorePct: scoreTotal ? Math.round((scoreSum / scoreTotal) * 100) : null,
      coursesCompleted: a.completed.size,
      courses: courseRows,
    });
  }

  rows.sort((x, y) => (y.lastActive ?? "").localeCompare(x.lastActive ?? ""));
  return rows;
}
