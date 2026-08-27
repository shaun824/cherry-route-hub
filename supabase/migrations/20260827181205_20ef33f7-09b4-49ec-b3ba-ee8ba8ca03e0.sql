CREATE TABLE public.tracking_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entrant_id uuid REFERENCES public.entrants(id) ON DELETE SET NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_m real,
  battery_pct integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracking_points_event_user_idx ON public.tracking_points (event_id, user_id, recorded_at DESC);
CREATE INDEX tracking_points_event_recorded_idx ON public.tracking_points (event_id, recorded_at DESC);

GRANT SELECT ON public.tracking_points TO anon;
GRANT SELECT, INSERT ON public.tracking_points TO authenticated;
GRANT ALL ON public.tracking_points TO service_role;

ALTER TABLE public.tracking_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tracking points"
  ON public.tracking_points FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Riders add their own tracking points"
  ON public.tracking_points FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tracking_sos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lat double precision,
  lng double precision,
  accuracy_m real,
  message text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracking_sos_event_idx ON public.tracking_sos (event_id, created_at DESC);

GRANT SELECT, INSERT ON public.tracking_sos TO authenticated;
GRANT ALL ON public.tracking_sos TO service_role;

ALTER TABLE public.tracking_sos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders create their own SOS alerts"
  ON public.tracking_sos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Riders view their own SOS alerts"
  ON public.tracking_sos FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all SOS alerts"
  ON public.tracking_sos FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE TRIGGER tracking_sos_touch BEFORE UPDATE ON public.tracking_sos
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();