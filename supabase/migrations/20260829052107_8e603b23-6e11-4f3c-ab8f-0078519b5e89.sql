ALTER TABLE public.event_village_tents
  ADD COLUMN IF NOT EXISTS tent_type text NOT NULL DEFAULT 'rce';

ALTER TABLE public.event_village_tents
  DROP CONSTRAINT IF EXISTS event_village_tents_tent_type_check;

ALTER TABLE public.event_village_tents
  ADD CONSTRAINT event_village_tents_tent_type_check
  CHECK (tent_type IN ('rce', 'luxury'));