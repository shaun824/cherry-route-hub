CREATE TABLE public.website_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL DEFAULT 'tour-de-addo',
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  trip text,
  message text NOT NULL,
  consent boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  everlytic_synced boolean NOT NULL DEFAULT false,
  everlytic_error text,
  notified boolean NOT NULL DEFAULT false,
  auto_replied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.website_enquiries TO authenticated;
GRANT ALL ON public.website_enquiries TO service_role;
ALTER TABLE public.website_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read website enquiries" ON public.website_enquiries FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY "Admins update website enquiries" ON public.website_enquiries FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE INDEX website_enquiries_created_idx ON public.website_enquiries (event_key, created_at DESC);