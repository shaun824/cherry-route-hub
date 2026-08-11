UPDATE public.events
SET days = (
  SELECT jsonb_agg(
    CASE
      WHEN day->'routes' IS NULL OR jsonb_array_length(day->'routes') = 0 THEN day
      ELSE jsonb_set(day, '{routes}', (
        SELECT jsonb_agg(
          (r - 'distanceKm') || jsonb_build_object(
            'name', trim(regexp_replace(r->>'name', '\s*[—-]\s*[0-9]+([.,][0-9]+)?\s*km\s*$', '', 'i'))
          )
        )
        FROM jsonb_array_elements(day->'routes') AS r
      ))
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(days) WITH ORDINALITY AS t(day, ord)
)
WHERE id = 'ab944019-3455-4658-be9c-01b9c40e2bac';