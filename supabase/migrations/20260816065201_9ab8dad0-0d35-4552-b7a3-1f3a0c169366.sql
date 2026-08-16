INSERT INTO public.event_village_tents (event_id, label, lat, lng)
SELECT 'ab944019-3455-4658-be9c-01b9c40e2bac', '23', -33.3850612, 25.9108532
WHERE NOT EXISTS (SELECT 1 FROM public.event_village_tents WHERE event_id='ab944019-3455-4658-be9c-01b9c40e2bac' AND label='23');

UPDATE public.event_rooming r
SET tent_number = '23',
    village_tent_id = t.id,
    village_zone_id = t.zone_id,
    updated_at = now()
FROM public.event_village_tents t
WHERE t.event_id = r.event_id AND t.label = '23'
  AND r.id = '9b04245c-6c6a-4bc0-912b-41b944ed4918';