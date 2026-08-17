UPDATE public.events
SET days = (
  jsonb_set(
    jsonb_set(
      jsonb_set(
        days::jsonb,
        '{0,routes,1}',
        (days::jsonb #> '{0,routes,1}')
          || jsonb_build_object('kmlUrls', jsonb_build_array('/__l5e/assets-v1/20db3681-d42f-4a86-a3a0-40283f0d0536/ww-lourensford-day1-silver.gpx'), 'distanceKm', 25.9)
      ),
      '{1,routes,1}',
      (days::jsonb #> '{1,routes,1}')
        || jsonb_build_object('kmlUrls', jsonb_build_array('/__l5e/assets-v1/c6c51894-8dde-4e4d-b22d-9031bcb4f28d/ww-lourensford-day2-silver.gpx'), 'distanceKm', 23.7)
    ),
    '{1,routes,2}',
    (days::jsonb #> '{1,routes,2}')
      || jsonb_build_object('kmlUrls', jsonb_build_array('/__l5e/assets-v1/874c4d64-5167-4c22-ab53-ba957e8f902a/ww-lourensford-day2-bronze.gpx'), 'distanceKm', 12.5)
  )
)::json
WHERE id = '2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7';