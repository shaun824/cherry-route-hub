ALTER TABLE public.event_village_tents
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'tent';

ALTER TABLE public.event_village_tents
  DROP CONSTRAINT IF EXISTS event_village_tents_kind_check;
ALTER TABLE public.event_village_tents
  ADD CONSTRAINT event_village_tents_kind_check CHECK (kind IN ('tent','marker'));

-- Backfill: any existing pin sitting on an area outline vertex is a drawing marker
UPDATE public.event_village_tents t
SET kind = 'marker'
WHERE EXISTS (
  SELECT 1
  FROM public.event_village_maps m
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.zones, '[]'::jsonb)) z
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(z->'points', '[]'::jsonb)) p
  WHERE m.event_id = t.event_id
    AND sqrt(
      pow(((p->>'lat')::float8 - t.lat) * 111320, 2) +
      pow(((p->>'lng')::float8 - t.lng) * 111320 * cos(radians(t.lat)), 2)
    ) < 1.5
);