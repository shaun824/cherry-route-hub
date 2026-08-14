UPDATE public.events
SET classes = '[
  {"id":"c1","label":"Nyathi Group 1 | Racing Snakes - 18kmh average","description":"Suitable for the fit looking to push themselves. 3 Nights of Glamping and 3 days of MTB riding with all meals and drinks included. Not Currently Selling","distanceKm":100,"priceZAR":15700},
  {"id":"c3","label":"Nyathi Group 2 | Relaxed and on holiday - 12kmh average","description":"For the relaxed group riding at an easy pace. 3 Nights of Glamping and 3 days of MTB riding with all meals and drinks included. WAITING LIST ONLY","distanceKm":100,"priceZAR":15700},
  {"id":"c4","label":"No Hassle Package - E Bike + Shuttle + Event","description":"Included is Airport pickup and accommodation on 20 August | Transport to event on 21 August | E - Bike Rental for 4 days | 3 Nights of Glamping with all meals and drinks included | Transport back on 24 August to PLZ Airport Not Currently Selling","distanceKm":100,"priceZAR":23750}
]'::jsonb
WHERE id = 'ab944019-3455-4658-be9c-01b9c40e2bac';

UPDATE public.event_entrants
SET category = 'Nyathi Group 2 | Relaxed and on holiday - 12kmh average'
WHERE event_id = 'ab944019-3455-4658-be9c-01b9c40e2bac'
  AND category IN (
    'Nyathi Group 2 | Moderate pace but keen for a pedal - 15km average.',
    'Nyathi Group 3 | Relaxed and on holiday - 12kmh average'
  );