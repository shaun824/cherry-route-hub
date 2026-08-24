CREATE TABLE public.learn_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'business',
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.event_departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE,
  generation_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learn_courses TO authenticated;
GRANT ALL ON public.learn_courses TO service_role;
ALTER TABLE public.learn_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can read published courses" ON public.learn_courses
  FOR SELECT TO authenticated
  USING (
    (status = 'published' AND (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role)))
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Admins manage courses" ON public.learn_courses
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER learn_courses_touch BEFORE UPDATE ON public.learn_courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.learn_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.learn_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learn_modules TO authenticated;
GRANT ALL ON public.learn_modules TO service_role;
ALTER TABLE public.learn_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can read modules of readable courses" ON public.learn_modules
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learn_courses c WHERE c.id = course_id));
CREATE POLICY "Admins manage modules" ON public.learn_modules
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER learn_modules_touch BEFORE UPDATE ON public.learn_modules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.learn_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.learn_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  why_it_matters TEXT,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learn_lessons TO authenticated;
GRANT ALL ON public.learn_lessons TO service_role;
ALTER TABLE public.learn_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can read lessons of readable modules" ON public.learn_lessons
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learn_modules m WHERE m.id = module_id));
CREATE POLICY "Admins manage lessons" ON public.learn_lessons
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER learn_lessons_touch BEFORE UPDATE ON public.learn_lessons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.learn_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.learn_modules(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_index INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learn_quiz_questions TO authenticated;
GRANT ALL ON public.learn_quiz_questions TO service_role;
ALTER TABLE public.learn_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can read quiz questions" ON public.learn_quiz_questions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learn_modules m WHERE m.id = module_id));
CREATE POLICY "Admins manage quiz questions" ON public.learn_quiz_questions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER learn_quiz_questions_touch BEFORE UPDATE ON public.learn_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.learn_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.learn_lessons(id) ON DELETE CASCADE,
  done BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learn_progress TO authenticated;
GRANT ALL ON public.learn_progress TO service_role;
ALTER TABLE public.learn_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progress" ON public.learn_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all progress" ON public.learn_progress
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER learn_progress_touch BEFORE UPDATE ON public.learn_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.learn_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.learn_modules(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.learn_quiz_attempts TO authenticated;
GRANT ALL ON public.learn_quiz_attempts TO service_role;
ALTER TABLE public.learn_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own attempts" ON public.learn_quiz_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own attempts" ON public.learn_quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.learn_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learn_courses(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

GRANT SELECT, INSERT ON public.learn_completions TO authenticated;
GRANT ALL ON public.learn_completions TO service_role;
ALTER TABLE public.learn_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own completions" ON public.learn_completions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own completions" ON public.learn_completions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX learn_modules_course_idx ON public.learn_modules(course_id, sort_order);
CREATE INDEX learn_lessons_module_idx ON public.learn_lessons(module_id, sort_order);
CREATE INDEX learn_quiz_module_idx ON public.learn_quiz_questions(module_id, sort_order);