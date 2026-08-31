-- 1. Master catalogue gains category + home location
ALTER TABLE public.branding_inventory
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'branding',
  ADD COLUMN IF NOT EXISTS home_location text;

-- 2. Event load list gains category, location, run link and tick stamps
ALTER TABLE public.event_branding_bookings
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'branding',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS qty_label text,
  ADD COLUMN IF NOT EXISTS run_id uuid,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packed_at timestamptz,
  ADD COLUMN IF NOT EXISTS packed_by uuid,
  ADD COLUMN IF NOT EXISTS on_site_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_site_by uuid,
  ADD COLUMN IF NOT EXISTS setup_at timestamptz,
  ADD COLUMN IF NOT EXISTS setup_by uuid,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_by uuid;

-- 3. Logistics runs (vehicles / drivers / dates)
CREATE TABLE IF NOT EXISTS public.event_logistics_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  run_date date,
  direction text NOT NULL DEFAULT 'out',
  driver text,
  vehicle text,
  taking text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_logistics_runs TO authenticated;
GRANT ALL ON public.event_logistics_runs TO service_role;

ALTER TABLE public.event_logistics_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew and admins read logistics runs"
  ON public.event_logistics_runs FOR SELECT TO authenticated
  USING (private.is_crew() OR private.is_admin());

CREATE POLICY "Crew and admins manage logistics runs"
  ON public.event_logistics_runs FOR ALL TO authenticated
  USING (private.is_crew() OR private.is_admin())
  WITH CHECK (private.is_crew() OR private.is_admin());

CREATE TRIGGER event_logistics_runs_touch
  BEFORE UPDATE ON public.event_logistics_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.event_branding_bookings
  ADD CONSTRAINT event_branding_bookings_run_fk
  FOREIGN KEY (run_id) REFERENCES public.event_logistics_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_logistics_runs_event_idx ON public.event_logistics_runs(event_id, run_date);
CREATE INDEX IF NOT EXISTS event_branding_bookings_cat_idx ON public.event_branding_bookings(event_id, category);
