UPDATE public.events
SET days = (
  SELECT jsonb_agg(
    CASE WHEN d ? 'routes' AND jsonb_array_length(d->'routes') > 0 THEN
      jsonb_set(d, '{routes}', (
        SELECT jsonb_agg(
          CASE
            WHEN r->>'id' = 'd1-route' THEN jsonb_set(jsonb_set(r, '{elevationM}', '775'), '{distanceKm}', '65.9')
            WHEN r->>'id' = 'd2-route' THEN jsonb_set(jsonb_set(r, '{elevationM}', '404'), '{distanceKm}', '35.5')
            WHEN r->>'id' = 'd3-route' THEN jsonb_set(jsonb_set(r, '{elevationM}', '146'), '{distanceKm}', '18.8')
            ELSE r
          END
        )
        FROM jsonb_array_elements(d->'routes') AS r
      ))
    ELSE d END
  )
  FROM jsonb_array_elements(days::jsonb) AS d
)::jsonb,
distance_km = 120.2,
updated_at = now()
WHERE name = 'Tour de Addo 2026 | Best of Nyathi';