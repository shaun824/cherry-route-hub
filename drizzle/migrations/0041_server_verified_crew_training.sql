REVOKE INSERT, UPDATE, DELETE ON public.learn_quiz_attempts, public.learn_completions FROM authenticated, anon;
GRANT SELECT ON public.learn_quiz_attempts, public.learn_completions TO authenticated;
GRANT ALL ON public.learn_quiz_attempts, public.learn_completions TO service_role;
CREATE POLICY "Admins manage quiz questions only" ON public.learn_quiz_questions AS RESTRICTIVE FOR SELECT TO authenticated USING (private.is_admin());
CREATE VIEW public.learn_quiz_prompts WITH (security_barrier=true) AS SELECT q.id,q.module_id,q.question,q.options,q.sort_order FROM public.learn_quiz_questions q JOIN public.learn_modules m ON m.id=q.module_id JOIN public.learn_courses c ON c.id=m.course_id WHERE private.is_admin() OR (private.is_crew() AND c.status='published' AND NOT m.hidden);
GRANT SELECT ON public.learn_quiz_prompts TO authenticated;
GRANT ALL ON public.learn_quiz_prompts TO service_role;
REVOKE ALL ON public.learn_quiz_prompts FROM anon;