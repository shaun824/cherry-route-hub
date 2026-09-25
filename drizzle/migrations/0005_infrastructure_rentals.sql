ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'race';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_contact text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS build_date date;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS breakdown_date date;
CREATE INDEX IF NOT EXISTS events_event_type_idx ON public.events(event_type);

CREATE TABLE public.event_share_links (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_share_links TO authenticated;
GRANT ALL ON public.event_share_links TO service_role;
ALTER TABLE public.event_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage share links" ON public.event_share_links FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));