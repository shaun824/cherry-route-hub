// A single training course: modules, lessons with tick-off, and a short quiz
// at the end of each module.
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronDown, Circle, Loader2, Lightbulb, Trophy } from "lucide-react";
import { useIsCrew } from "@/lib/auth";
import { LearnBody } from "@/components/learn-body";
import { Button } from "@/components/ui/button";
import {
  courseProgress,
  fetchLearnCourse,
  fetchLearnModules,
  fetchLearnProgress,
  fetchQuizAttempts,
  markCourseComplete,
  quizPassed,
  recordQuizAttempt,
  setLessonDone,
  type LearnModule,
} from "@/lib/learn";

export const Route = createFileRoute("/crew/learn/$courseId")({
  head: () => ({
    meta: [
      { title: "Course · Red Cherry Crew" },
      { name: "description", content: "Work through a Red Cherry crew training course, module by module." },
      { property: "og:title", content: "Course · Red Cherry Crew" },
      { property: "og:description", content: "Crew training built from live event data." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { isCrew, loading, user } = useIsCrew();
  const qc = useQueryClient();
  const [openModule, setOpenModule] = useState<string | null>(null);

  const courseQ = useQuery({ queryKey: ["learn-course", courseId], queryFn: () => fetchLearnCourse(courseId), enabled: isCrew });
  const modulesQ = useQuery({ queryKey: ["learn-modules", courseId], queryFn: () => fetchLearnModules(courseId), enabled: isCrew });
  const progressQ = useQuery({
    queryKey: ["learn-progress", user?.id],
    enabled: isCrew && !!user,
    queryFn: () => (user ? fetchLearnProgress(user.id) : Promise.resolve(new Set<string>())),
  });
  const attemptsQ = useQuery({
    queryKey: ["learn-attempts", user?.id],
    enabled: isCrew && !!user,
    queryFn: () => (user ? fetchQuizAttempts(user.id) : Promise.resolve([])),
  });

  const modules = modulesQ.data ?? [];
  const done = progressQ.data ?? new Set<string>();
  const progress = useMemo(() => courseProgress(modules, done), [modules, done]);

  const bestByModule = useMemo(() => {
    const out = new Map<string, { score: number; total: number; passed: boolean }>();
    for (const a of attemptsQ.data ?? []) {
      const cur = out.get(a.module_id);
      if (!cur || a.score > cur.score) out.set(a.module_id, { score: a.score, total: a.total, passed: a.passed });
    }
    return out;
  }, [attemptsQ.data]);

  async function toggle(lessonId: string, next: boolean) {
    if (!user) return;
    await setLessonDone(user.id, lessonId, next);
    qc.setQueryData<Set<string>>(["learn-progress", user.id], (prev) => {
      const s = new Set(prev ?? []);
      if (next) s.add(lessonId);
      else s.delete(lessonId);
      return s;
    });
    if (next && progress.total && progress.done + 1 >= progress.total) {
      await markCourseComplete(user.id, courseId);
      qc.invalidateQueries({ queryKey: ["learn-completions", user.id] });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (!isCrew) return <Navigate to="/crew/login" />;

  const course = courseQ.data;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <Link to="/crew/learn" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>

      <header className="mt-3">
        <h1 className="font-display text-2xl font-bold">{course?.title ?? "Course"}</h1>
        {course?.summary ? <p className="mt-1 text-sm text-ink-soft">{course.summary}</p> : null}
      </header>

      {progress.total ? (
        <div className="mt-4 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-ink">Your progress</span>
            <span className="text-ink-soft">
              {progress.done} / {progress.total} lessons
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      ) : null}

      {modulesQ.isLoading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        </div>
      ) : !modules.length ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          This course hasn't been built yet.
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {modules.map((m, i) => {
            const open = openModule === m.id;
            const modDone = m.lessons.length > 0 && m.lessons.every((l) => done.has(l.id));
            const best = bestByModule.get(m.id);
            return (
              <li key={m.id} className="overflow-hidden rounded-2xl border border-line bg-card">
                <button
                  type="button"
                  onClick={() => setOpenModule(open ? null : m.id)}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      modDone ? "bg-green-600 text-white" : "bg-brand/10 text-brand"
                    }`}
                  >
                    {modDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-ink">{m.title}</span>
                    {m.summary ? <span className="mt-0.5 block text-sm text-ink-soft">{m.summary}</span> : null}
                    <span className="mt-1 block text-xs text-ink-soft">
                      {m.lessons.length} lesson{m.lessons.length === 1 ? "" : "s"}
                      {m.questions.length ? ` · ${m.questions.length}-question quiz` : ""}
                      {best ? ` · best ${best.score}/${best.total}` : ""}
                    </span>
                  </span>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-ink-soft transition ${open ? "rotate-180" : ""}`} />
                </button>

                {open ? (
                  <div className="border-t border-line p-4">
                    <div className="space-y-5">
                      {m.lessons.map((l) => (
                        <article key={l.id}>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-display text-base font-bold text-ink">{l.title}</h3>
                            <button
                              type="button"
                              onClick={() => toggle(l.id, !done.has(l.id))}
                              className="shrink-0 text-ink-soft transition hover:text-brand"
                              aria-label={done.has(l.id) ? "Mark as not read" : "Mark as read"}
                            >
                              {done.has(l.id) ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <Circle className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                          <div className="mt-1.5">
                            <LearnBody text={l.body} />
                          </div>
                          {l.why_it_matters ? (
                            <p className="mt-2 flex gap-2 rounded-xl bg-brand/5 p-3 text-sm text-ink">
                              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                              <span>{l.why_it_matters}</span>
                            </p>
                          ) : null}
                        </article>
                      ))}
                    </div>

                    {m.questions.length ? <ModuleQuiz module={m} userId={user?.id} /> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ModuleQuiz({ module: m, userId }: { module: LearnModule; userId?: string }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const total = m.questions.length;
  const score = m.questions.filter((q) => answers[q.id] === q.correct_index).length;
  const passed = quizPassed(score, total);

  async function submit() {
    setSubmitted(true);
    if (userId) {
      await recordQuizAttempt(userId, m.id, score, total, passed);
      qc.invalidateQueries({ queryKey: ["learn-attempts", userId] });
    }
  }

  function chooseAnswer(questionId: string, optionIndex: number) {
    if (submitted) return;
    setAnswers((current) => ({ ...current, [questionId]: optionIndex }));
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-bg p-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-brand" />
        <h4 className="font-display text-sm font-bold">Check yourself</h4>
      </div>
      <ol className="mt-3 space-y-4">
        {m.questions.map((q, qi) => (
          <li key={q.id}>
            <p className="text-sm font-semibold text-ink">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-2 space-y-1.5">
              {q.options.map((opt, oi) => {
                const chosen = answers[q.id] === oi;
                const right = submitted && oi === q.correct_index;
                const wrong = submitted && chosen && oi !== q.correct_index;
                return (
                  <label
                    key={oi}
                    className={`flex w-full cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                      right
                        ? "border-green-600 bg-green-50 text-green-900"
                        : wrong
                          ? "border-red-500 bg-red-50 text-red-900"
                          : chosen
                            ? "border-primary bg-accent text-ink"
                            : "border-border bg-card text-ink-soft"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`quiz-${m.id}-${q.id}`}
                      value={oi}
                      checked={chosen}
                      disabled={submitted}
                      onChange={() => chooseAnswer(q.id, oi)}
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">{opt}</span>
                    {chosen ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : null}
                  </label>
                );
              })}
            </div>
            {submitted && q.explanation ? <p className="mt-1.5 text-xs text-ink-soft">{q.explanation}</p> : null}
          </li>
        ))}
      </ol>

      {submitted ? (
        <div className="mt-4 flex items-center justify-between">
          <p className={`text-sm font-semibold ${passed ? "text-green-700" : "text-red-700"}`}>
            {score} / {total} — {passed ? "nicely done" : "have another look and try again"}
          </p>
          <Button
            type="button"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          disabled={Object.keys(answers).length < total}
          onClick={submit}
          className="mt-4 w-full rounded-full"
        >
          Check answers
        </Button>
      )}
    </div>
  );
}
