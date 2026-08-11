CREATE TABLE public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  category text not null default 'issue',
  message text not null,
  page_path text,
  user_agent text,
  created_at timestamptz not null default now()
);

GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT SELECT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback" ON public.feedback FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can read feedback" ON public.feedback FOR SELECT TO authenticated USING (public.is_admin());