CREATE TABLE public.event_interest_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  phone text,
  topic text,
  source text,
  consent boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  everlytic_synced boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX event_interest_signups_event_email_key ON public.event_interest_signups (event_id, lower(email));
CREATE INDEX event_interest_signups_event_idx ON public.event_interest_signups (event_id);
GRANT SELECT ON public.event_interest_signups TO authenticated;
GRANT ALL ON public.event_interest_signups TO service_role;
ALTER TABLE public.event_interest_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read event interest sign-ups"
  ON public.event_interest_signups FOR SELECT TO authenticated
  USING (private.is_admin());

ALTER TABLE public.event_email_campaigns ADD COLUMN audience text NOT NULL DEFAULT 'entrants';
ALTER TABLE public.event_email_steps ADD COLUMN send_at timestamptz;
ALTER TABLE public.event_email_steps ADD COLUMN theme text;
ALTER TABLE public.events ADD COLUMN everlytic_interest_list_id text;