UPDATE public.event_info_blocks
SET venue_lat = -33.3848333,
    venue_lng = 25.9106389,
    map_embed_url = 'https://www.google.com/maps/place/@-33.3848333,25.9106389,16z/data=!3m1!1e3!4m4!3m3!8m2!3d-33.3848333!4d25.9106389',
    updated_at = now()
WHERE event_id = 'ab944019-3455-4658-be9c-01b9c40e2bac';