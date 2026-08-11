INSERT INTO public.event_village_maps (event_id, image_url, intro, hotspots)
VALUES (
  '2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7',
  '/__l5e/assets-v1/fed62ba7-1189-4ba7-ae82-e0b8253af77e/weekend-warrior-village.jpg',
  'Tap or hover any point on the village map to see what''s there. Filter by category to find parking, food, ablutions, bike services and more.',
  '[
    {"id":"truck-stop","x":31,"y":12,"title":"Green Motion Truck Stop","category":"parking","description":"Truck and trailer drop-off zone at the top of the village."},
    {"id":"showers","x":53,"y":11,"title":"Showers & Toilets","category":"toilets","description":"Main ablution block with hot showers and toilets."},
    {"id":"tented-village","x":35,"y":26,"title":"Tented Village","category":"camping","description":"Pre-pitched tents for riders who booked the tented village package."},
    {"id":"parking","x":12,"y":37,"title":"Day Riders & Tent Users Parking","category":"parking","description":"Parking for day riders and anyone staying in the tented village."},
    {"id":"cycle-lab","x":56,"y":29,"title":"Cycle Lab Setup","category":"bike","description":"Bike setup, spares and mechanical support."},
    {"id":"charging","x":71,"y":26,"title":"Peninsula Power Charging Station","category":"other","description":"Charge your devices and batteries here."},
    {"id":"coffee-bar","x":37,"y":38,"title":"Otto1890 Coffee Bar","category":"food","description":"Coffee and light refreshments."},
    {"id":"rudy","x":55,"y":38,"title":"Rudy Project Stand","category":"shop","description":"Eyewear and helmets on display."},
    {"id":"country-club","x":83,"y":33,"title":"Bar & Food in the Country Club","category":"bar","description":"Indoor bar and food service in the country club."},
    {"id":"ebike-charging","x":91,"y":40,"title":"E-Bike Charging in the Hall","category":"bike","description":"Secure e-bike battery charging inside the hall."},
    {"id":"demo-area","x":40,"y":48,"title":"Westvaal Demo Area","category":"stage","description":"Vehicle and product demo area."},
    {"id":"tru-cape","x":55,"y":48,"title":"Tru-Cape Tent","category":"other","description":"Tru-Cape hospitality tent."},
    {"id":"food-vendors","x":67,"y":44,"title":"Food Vendors","category":"food","description":"Food trucks and vendor stalls."},
    {"id":"bike-wash","x":74,"y":43,"title":"Squirt Bike Wash","category":"bike","description":"Wash your bike down after each stage."},
    {"id":"toilets-2","x":79,"y":54,"title":"Toilets","category":"toilets","description":"Additional toilets near the chill zone."},
    {"id":"finish","x":43,"y":60,"title":"Otto1890 Finish Line","category":"finish","description":"Race finish gantry."},
    {"id":"chill-zone","x":67,"y":65,"title":"SAB Chill Zone & Beer Garden","category":"bar","description":"Relax with a cold one after your ride."},
    {"id":"media-center","x":41,"y":74,"title":"Kazin Media Center","category":"other","description":"Media centre and event office."},
    {"id":"own-tent","x":37,"y":89,"title":"Own Tent Area","category":"camping","description":"Pitch your own tent in this area."}
  ]'::jsonb
)
ON CONFLICT (event_id) DO UPDATE
SET image_url = EXCLUDED.image_url,
    intro = EXCLUDED.intro,
    hotspots = EXCLUDED.hotspots,
    updated_at = now();