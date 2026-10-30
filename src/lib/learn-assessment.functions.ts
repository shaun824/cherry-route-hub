import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const submitLearnAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ moduleId: z.string().uuid(), answers: z.record(z.string().uuid(), z.number().int().min(0).max(20)) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: module } = await context.supabase.from("learn_modules").select("id, course_id").eq("id", data.moduleId).eq("hidden", false).maybeSingle();
    if (!module) throw new Error("Module not found");
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "crew"]);
    if (!roles?.length) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questions, error } = await supabaseAdmin.from("learn_quiz_questions").select("id, correct_index, explanation").eq("module_id", data.moduleId);
    if (error || !questions?.length) throw new Error("Quiz not found");
    if (Object.keys(data.answers).some((id) => !questions.some((q) => q.id === id))) throw new Error("Unknown question");
    const score = questions.filter((q) => data.answers[q.id] === q.correct_index).length;
    const total = questions.length;
    const passed = score / total >= 0.7;
    const { error: saved } = await supabaseAdmin.from("learn_quiz_attempts").insert({ user_id: context.userId, module_id: data.moduleId, score, total, passed });
    if (saved) throw new Error("Could not save assessment");
    return { score, total, passed, questions };
  });

export const completeLearnCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: modules } = await context.supabase.from("learn_modules").select("id").eq("course_id", data.courseId).eq("hidden", false);
    if (!modules?.length) return { complete: false };
    const ids = modules.map((m) => m.id);
    const { data: lessons } = await context.supabase.from("learn_lessons").select("id").in("module_id", ids).eq("hidden", false);
    const { data: progress } = await context.supabase.from("learn_progress").select("lesson_id").eq("user_id", context.userId).eq("done", true);
    const done = new Set(progress?.map((p) => p.lesson_id));
    if (lessons?.some((l) => !done.has(l.id))) return { complete: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quiz } = await supabaseAdmin.from("learn_quiz_questions").select("module_id").in("module_id", ids);
    const { data: attempts } = await context.supabase.from("learn_quiz_attempts").select("module_id").eq("user_id", context.userId).eq("passed", true);
    const passed = new Set(attempts?.map((a) => a.module_id));
    if (quiz?.some((q) => !passed.has(q.module_id))) return { complete: false };
    const { error } = await supabaseAdmin.from("learn_completions").upsert({ user_id: context.userId, course_id: data.courseId }, { onConflict: "user_id,course_id" });
    if (error) throw new Error("Could not save course completion");
    return { complete: true };
  });