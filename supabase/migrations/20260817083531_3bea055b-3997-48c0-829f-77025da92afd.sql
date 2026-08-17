UPDATE public.events
SET days = jsonb_build_array(
  (days::jsonb -> 0) || jsonb_build_object(
    'routes', jsonb_build_array(
      ((days::jsonb -> 0 -> 'routes' -> 0) || jsonb_build_object('customMarkers', jsonb_build_array(
        jsonb_build_object('id','wp1','lat',-34.04473254943552,'lng',18.88729933772862,'icon','water','name','Waterpoint 1 — Peninsula Power Products','color','#0ea5e9','logoUrl','/__l5e/assets-v1/f60ca7ba-96e6-4059-9ed7-d0d8c0d46280/peninsula-power-trim.png','description','Day 1 waterpoint supported by Peninsula Power Products'),
        jsonb_build_object('id','wp2','lat',-34.04594271824797,'lng',18.91933374810909,'icon','water','name','Waterpoint 2 — Cycle Lab','color','#0ea5e9','logoUrl','/__l5e/assets-v1/c431f655-8529-436a-be82-8b1ab31c1858/cycle-lab-trim.png','description','Day 1 waterpoint supported by Cycle Lab'),
        jsonb_build_object('id','wp3','lat',-34.02780328396192,'lng',18.9145999137269,'icon','water','name','Waterpoint 3 — Nutri-Go','color','#0ea5e9','logoUrl','/__l5e/assets-v1/f1f5324c-5634-4e13-a4ba-5b7f1b914aa2/nutri-go-trim.png','description','Day 1 waterpoint supported by Nutri-Go'),
        jsonb_build_object('id','m1','lat',-34.06012941238922,'lng',18.89043611658791,'icon','warning','name','Marshal','color','#f97316'),
        jsonb_build_object('id','m2','lat',-34.05751016007832,'lng',18.89586488413873,'icon','warning','name','Marshal','color','#f97316'),
        jsonb_build_object('id','m3','lat',-34.05263388064112,'lng',18.90425738463503,'icon','warning','name','Marshal','color','#f97316')
      ))),
      days::jsonb -> 0 -> 'routes' -> 1,
      days::jsonb -> 0 -> 'routes' -> 2
    )
  ),
  (days::jsonb -> 1) || jsonb_build_object(
    'routes', jsonb_build_array(
      jsonb_build_object(
        'id','d2-gold','name','Gold — Day 2','tier','Gold','color','#d4a017',
        'kmlUrls', jsonb_build_array('/__l5e/assets-v1/dac24d87-236d-4727-b29a-cfd362706c4d/ww-lourensford-day2-gold.kml'),
        'distanceKm', 43.6,
        'customMarkers', jsonb_build_array(
          jsonb_build_object('id','d2-wp1','lat',-34.04911786731392,'lng',18.8821233310624,'icon','water','name','Waterpoint 1 — Peninsula Power Products','color','#0ea5e9','logoUrl','/__l5e/assets-v1/f60ca7ba-96e6-4059-9ed7-d0d8c0d46280/peninsula-power-trim.png','description','Day 2 waterpoint supported by Peninsula Power Products'),
          jsonb_build_object('id','d2-wp2','lat',-34.0513416027114,'lng',18.95602062923217,'icon','water','name','Waterpoint 2 — Nutri-Go','color','#0ea5e9','logoUrl','/__l5e/assets-v1/f1f5324c-5634-4e13-a4ba-5b7f1b914aa2/nutri-go-trim.png','description','Day 2 waterpoint supported by Nutri-Go'),
          jsonb_build_object('id','d2-wp3','lat',-34.02666044901907,'lng',18.9105526363005,'icon','water','name','Waterpoint 3 — Cycle Lab','color','#0ea5e9','logoUrl','/__l5e/assets-v1/c431f655-8529-436a-be82-8b1ab31c1858/cycle-lab-trim.png','description','Day 2 waterpoint supported by Cycle Lab'),
          jsonb_build_object('id','d2-m1','lat',-34.04455641031642,'lng',18.92617085986119,'icon','warning','name','Marshal','color','#f97316'),
          jsonb_build_object('id','d2-m2','lat',-34.04766020411856,'lng',18.92551083693202,'icon','warning','name','Marshal','color','#f97316'),
          jsonb_build_object('id','d2-m3','lat',-34.05197783146331,'lng',18.90456004723231,'icon','warning','name','Marshal','color','#f97316'),
          jsonb_build_object('id','d2-m4','lat',-34.05838815969138,'lng',18.89403950113924,'icon','warning','name','Marshal','color','#f97316')
        )
      ),
      jsonb_build_object('id','d2-silver','name','Silver — Day 2','tier','Silver','color','#64748b',
        'kmlUrls', jsonb_build_array('/__l5e/assets-v1/f1cb11be-febe-4b3a-80ca-9009ec12b131/ww-lourensford-day2-silver.kml'),
        'distanceKm', 21.4, 'customMarkers', '[]'::jsonb),
      jsonb_build_object('id','d2-bronze','name','Bronze — Day 2','tier','Bronze','color','#a0522d',
        'kmlUrls', jsonb_build_array('/__l5e/assets-v1/06e86a8a-76c0-405b-9a36-8575b9245981/ww-lourensford-day2-bronze.kml'),
        'distanceKm', 10.5, 'customMarkers', '[]'::jsonb)
    )
  )
)
WHERE id = '2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7';