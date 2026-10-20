CREATE TABLE public.entry_interest_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'weekend-warrior-2027',
  everlytic_synced boolean NOT NULL DEFAULT false,
  confirmation_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.entry_interest_signups TO authenticated;
GRANT ALL ON public.entry_interest_signups TO service_role;
ALTER TABLE public.entry_interest_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read entry interest" ON public.entry_interest_signups FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));