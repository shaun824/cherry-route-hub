ALTER TABLE public.event_info_blocks
  ADD COLUMN IF NOT EXISTS reg_venue_name text,
  ADD COLUMN IF NOT EXISTS reg_venue_address text,
  ADD COLUMN IF NOT EXISTS reg_venue_lat numeric,
  ADD COLUMN IF NOT EXISTS reg_venue_lng numeric,
  ADD COLUMN IF NOT EXISTS reg_notes text;

UPDATE public.event_info_blocks
SET reg_venue_name = 'Addo Main Camp (Addo Elephant National Park)',
    reg_venue_address = 'Addo Main Camp, Addo Elephant National Park, Addo, Eastern Cape',
    reg_venue_lat = -33.4869,
    reg_venue_lng = 25.7503,
    reg_notes = 'Registration and check-in happen at Addo Main Camp — not at Nyathi Rest Camp. Check in at Addo Main Camp first, then head through to Nyathi for the riding days.'
WHERE event_id = 'ab944019-3455-4658-be9c-01b9c40e2bac';

INSERT INTO public.event_info_blocks (event_id, reg_venue_name, reg_venue_address, reg_venue_lat, reg_venue_lng, reg_notes)
SELECT 'ab944019-3455-4658-be9c-01b9c40e2bac', 'Addo Main Camp (Addo Elephant National Park)',
       'Addo Main Camp, Addo Elephant National Park, Addo, Eastern Cape', -33.4869, 25.7503,
       'Registration and check-in happen at Addo Main Camp — not at Nyathi Rest Camp. Check in at Addo Main Camp first, then head through to Nyathi for the riding days.'
WHERE NOT EXISTS (SELECT 1 FROM public.event_info_blocks WHERE event_id = 'ab944019-3455-4658-be9c-01b9c40e2bac');