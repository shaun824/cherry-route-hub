ALTER TABLE public.event_village_tents
  DROP CONSTRAINT IF EXISTS event_village_tents_tent_type_check;

ALTER TABLE public.event_village_tents
  ADD CONSTRAINT event_village_tents_tent_type_check
  CHECK (tent_type IN ('rce', 'luxury', 'luxury_no_veranda'));