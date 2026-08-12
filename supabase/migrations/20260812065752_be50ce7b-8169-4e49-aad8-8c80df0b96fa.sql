ALTER TABLE public.events ADD COLUMN IF NOT EXISTS photos_album_url text;

CREATE TABLE IF NOT EXISTS public.event_photos_cache (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  album_url text,
  refreshed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_photos_cache TO anon;
GRANT SELECT ON public.event_photos_cache TO authenticated;
GRANT ALL ON public.event_photos_cache TO service_role;

ALTER TABLE public.event_photos_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event photos are publicly readable"
  ON public.event_photos_cache FOR SELECT
  USING (true);

CREATE TRIGGER event_photos_cache_touch
  BEFORE UPDATE ON public.event_photos_cache
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();