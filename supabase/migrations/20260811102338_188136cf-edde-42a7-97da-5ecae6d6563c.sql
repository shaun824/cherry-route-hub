CREATE TABLE public.event_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_venues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_venues TO authenticated;
GRANT ALL ON public.event_venues TO service_role;

ALTER TABLE public.event_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read event venues" ON public.event_venues
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage event venues" ON public.event_venues
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER event_venues_touch BEFORE UPDATE ON public.event_venues
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX event_venues_event_idx ON public.event_venues(event_id);

CREATE TABLE public.event_rooming (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES public.event_venues(id) ON DELETE SET NULL,
  entrant_id uuid REFERENCES public.entrants(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  tent_number text,
  room_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rooming TO authenticated;
GRANT ALL ON public.event_rooming TO service_role;

ALTER TABLE public.event_rooming ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own rooming" ON public.event_rooming
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.entrants e
      WHERE e.id = event_rooming.entrant_id AND e.user_id = auth.uid()
    )
    OR (email IS NOT NULL AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );

CREATE POLICY "admins manage rooming" ON public.event_rooming
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER event_rooming_touch BEFORE UPDATE ON public.event_rooming
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX event_rooming_event_idx ON public.event_rooming(event_id);
CREATE INDEX event_rooming_entrant_idx ON public.event_rooming(entrant_id);
CREATE INDEX event_rooming_email_idx ON public.event_rooming(lower(email));