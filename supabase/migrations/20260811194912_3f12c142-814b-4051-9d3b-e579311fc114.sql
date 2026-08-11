CREATE TABLE public.event_village_maps (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  image_url text,
  intro text,
  hotspots jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_village_maps TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_village_maps TO authenticated;
GRANT ALL ON public.event_village_maps TO service_role;
ALTER TABLE public.event_village_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Village maps are viewable by everyone" ON public.event_village_maps FOR SELECT USING (true);
CREATE POLICY "Admins manage village maps" ON public.event_village_maps FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER touch_event_village_maps BEFORE UPDATE ON public.event_village_maps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();