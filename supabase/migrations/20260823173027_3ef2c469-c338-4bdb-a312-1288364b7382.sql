CREATE TABLE public.event_venue_sync (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  stays jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz,
  applied_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_venue_sync TO authenticated;
GRANT ALL ON public.event_venue_sync TO service_role;
ALTER TABLE public.event_venue_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage venue sync" ON public.event_venue_sync FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE TRIGGER event_venue_sync_touch BEFORE UPDATE ON public.event_venue_sync FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();