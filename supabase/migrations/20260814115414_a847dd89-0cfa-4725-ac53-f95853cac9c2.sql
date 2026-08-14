UPDATE public.events
SET schedule = (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'dayId' = 'd1' AND item->>'label' = 'Ride begins'
        THEN jsonb_set(item, '{details}', '"Day 1 — 65.9 km with 722 m of climbing."')
      WHEN item->>'dayId' = 'd2' AND item->>'label' = 'Ride begins'
        THEN jsonb_set(item, '{details}', '"Day 2 — 35.5 km with 400 m of climbing."')
      WHEN item->>'dayId' = 'd3' AND item->>'label' LIKE 'Earlier start today%'
        THEN jsonb_set(item, '{details}', '"Day 3 — 18.8 km with 171 m of climbing."')
      ELSE item
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(schedule) WITH ORDINALITY AS t(item, ord)
),
distance_km = 120,
updated_at = now()
WHERE name = 'Tour de Addo 2026 | Best of Nyathi';

UPDATE public.event_info_blocks i
SET distance_km = 120,
    route_description = 'Tour de Addo is a unique 3-day mountain bike experience staged in the Addo Elephant National Park, offering a social ride with daily distances of roughly 19 km to 66 km (120 km in total). Riders will stay in luxury glamping sites and be accompanied by armed rangers due to the wildlife and terrain. E-Bikes are welcome and support vehicles are available for those who wish to rest.',
    updated_at = now()
FROM public.events e
WHERE e.id = i.event_id AND e.name = 'Tour de Addo 2026 | Best of Nyathi';