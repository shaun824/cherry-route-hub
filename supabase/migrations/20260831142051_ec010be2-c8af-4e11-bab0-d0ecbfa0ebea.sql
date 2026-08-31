CREATE TABLE public.branding_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  size_spec text,
  sponsor text,
  qty_owned integer NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branding_inventory TO authenticated;
GRANT ALL ON public.branding_inventory TO service_role;

ALTER TABLE public.branding_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew and admins read branding inventory"
  ON public.branding_inventory FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Crew and admins manage branding inventory"
  ON public.branding_inventory FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER branding_inventory_touch BEFORE UPDATE ON public.branding_inventory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.event_branding_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.branding_inventory(id) ON DELETE SET NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  size_spec text,
  sponsor text,
  qty integer NOT NULL DEFAULT 1,
  placement text,
  status text NOT NULL DEFAULT 'booked',
  village_spot_id text,
  department_id uuid REFERENCES public.event_departments(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_branding_bookings_event_idx ON public.event_branding_bookings (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_branding_bookings TO authenticated;
GRANT ALL ON public.event_branding_bookings TO service_role;

ALTER TABLE public.event_branding_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew and admins read branding bookings"
  ON public.event_branding_bookings FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Crew and admins manage branding bookings"
  ON public.event_branding_bookings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER event_branding_bookings_touch BEFORE UPDATE ON public.event_branding_bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();