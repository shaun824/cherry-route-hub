UPDATE public.events
SET days = replace(
      replace(days::text,
        (SELECT (regexp_matches(days::text, '/__l5e/assets-v1/[0-9a-f-]+/ww-lourensford-day1-silver\.kml'))[1]),
        '/__l5e/assets-v1/3cbb5f30-2d7c-4010-a4b3-4978c86186c0/ww-lourensford-day1-silver.kml'),
      (SELECT (regexp_matches(days::text, '/__l5e/assets-v1/[0-9a-f-]+/ww-lourensford-day1-bronze\.kml'))[1]),
      '/__l5e/assets-v1/5011f3af-18b8-41b9-a4c1-68aa06548cde/ww-lourensford-day1-bronze.kml')::jsonb
WHERE days::text LIKE '%ww-lourensford-day1-silver.kml%';