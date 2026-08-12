UPDATE public.events
SET days = replace(replace(replace(days::text,
      '"elevationM":715', '"elevationM":853'),
      '"name":"Silver — Day 1"', '"name":"Silver — Day 1"')
      , '"elevationM":null', '"elevationM":null')::jsonb
WHERE days::text LIKE '%ww-lourensford-day1-gold.kml%';