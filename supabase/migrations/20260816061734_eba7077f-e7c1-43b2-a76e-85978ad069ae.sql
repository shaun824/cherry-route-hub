-- Link rooming allocations to real event entries + optional tent pins on the village map
ALTER TABLE public.event_rooming ADD COLUMN IF NOT EXISTS event_entrant_id uuid REFERENCES public.event_entrants(id) ON DELETE SET NULL;
ALTER TABLE public.event_rooming ADD COLUMN IF NOT EXISTS village_tent_id uuid;
ALTER TABLE public.event_rooming ADD COLUMN IF NOT EXISTS match_source text NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS event_rooming_entry_idx ON public.event_rooming(event_entrant_id);
CREATE INDEX IF NOT EXISTS event_rooming_tent_idx ON public.event_rooming(village_tent_id);

CREATE TABLE IF NOT EXISTS public.event_village_tents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  zone_id text,
  capacity integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_village_tents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_village_tents TO authenticated;
GRANT ALL ON public.event_village_tents TO service_role;

ALTER TABLE public.event_village_tents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read village tents" ON public.event_village_tents;
CREATE POLICY "public read village tents" ON public.event_village_tents
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admins manage village tents" ON public.event_village_tents;
CREATE POLICY "admins manage village tents" ON public.event_village_tents
  FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP TRIGGER IF EXISTS event_village_tents_touch ON public.event_village_tents;
CREATE TRIGGER event_village_tents_touch BEFORE UPDATE ON public.event_village_tents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS event_village_tents_event_idx ON public.event_village_tents(event_id);

CREATE TABLE IF NOT EXISTS public.event_village_tent_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  zone_id text NOT NULL,
  pattern text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_village_tent_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_village_tent_rules TO authenticated;
GRANT ALL ON public.event_village_tent_rules TO service_role;

ALTER TABLE public.event_village_tent_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read tent rules" ON public.event_village_tent_rules;
CREATE POLICY "public read tent rules" ON public.event_village_tent_rules
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admins manage tent rules" ON public.event_village_tent_rules;
CREATE POLICY "admins manage tent rules" ON public.event_village_tent_rules
  FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP TRIGGER IF EXISTS event_village_tent_rules_touch ON public.event_village_tent_rules;
CREATE TRIGGER event_village_tent_rules_touch BEFORE UPDATE ON public.event_village_tent_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS event_village_tent_rules_event_idx ON public.event_village_tent_rules(event_id);

DROP POLICY IF EXISTS "read own rooming" ON public.event_rooming;
CREATE POLICY "read own rooming" ON public.event_rooming
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.entrants e
      WHERE e.id = event_rooming.entrant_id AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_entrants ee
      JOIN public.entrants e2 ON e2.id = ee.entrant_id
      WHERE ee.id = event_rooming.event_entrant_id AND e2.user_id = auth.uid()
    )
    OR (email IS NOT NULL AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );