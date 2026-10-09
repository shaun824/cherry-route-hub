ALTER TABLE public.entrants ADD COLUMN IF NOT EXISTS age_band text
  CHECK (age_band IS NULL OR age_band IN ('U14','14-17','18-24','25-34','35-44','45-54','55-64','65+'));

CREATE TABLE public.marketing_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  called_at timestamptz NOT NULL DEFAULT now(),
  authorized boolean NOT NULL,
  status int NOT NULL,
  events_returned int,
  ip text,
  user_agent text,
  duration_ms int
);
GRANT SELECT ON public.marketing_api_calls TO authenticated;
GRANT ALL ON public.marketing_api_calls TO service_role;
ALTER TABLE public.marketing_api_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read marketing api calls" ON public.marketing_api_calls
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));