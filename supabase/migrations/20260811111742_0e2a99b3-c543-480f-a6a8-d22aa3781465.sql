CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL DEFAULT 'pageview',
  path text NOT NULL,
  route_label text,
  referrer text,
  duration_ms integer,
  viewport_width integer,
  device text,
  user_agent text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.analytics_events TO anon;
GRANT INSERT, SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record their own activity"
ON public.analytics_events FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Admins can read analytics"
ON public.analytics_events FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
CREATE INDEX analytics_events_path_idx ON public.analytics_events (path);
CREATE INDEX analytics_events_session_idx ON public.analytics_events (session_id);