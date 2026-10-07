ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS collects_tshirt_size boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collects_jacket_size boolean NOT NULL DEFAULT false;

UPDATE public.events e SET collects_tshirt_size = true
WHERE EXISTS (SELECT 1 FROM public.event_entrants ee WHERE ee.event_id = e.id AND nullif(btrim(ee.tshirt_size), '') IS NOT NULL);

UPDATE public.events e SET collects_jacket_size = true
WHERE EXISTS (SELECT 1 FROM public.event_entrants ee WHERE ee.event_id = e.id AND nullif(btrim(ee.jacket_size), '') IS NOT NULL);