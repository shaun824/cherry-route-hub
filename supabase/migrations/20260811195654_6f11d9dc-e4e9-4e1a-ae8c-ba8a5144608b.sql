ALTER TABLE public.event_village_maps
  ADD COLUMN IF NOT EXISTS geo jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.event_village_maps
SET geo = jsonb_build_object('lat', -34.0640, 'lng', 18.8925, 'widthM', 520, 'rotation', 0)
WHERE event_id = '2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7';