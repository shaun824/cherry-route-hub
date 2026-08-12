UPDATE public.events
SET days = jsonb_build_array(
  jsonb_build_object(
    'id','d1','date','2026-10-17','label','Day 1',
    'routes', jsonb_build_array(
      jsonb_build_object(
        'id','d1-gold','tier','Gold','name','Gold — Day 1','distanceKm',43.3,'elevationM',715,
        'color','#d4a017',
        'kmlUrls', jsonb_build_array('/__l5e/assets-v1/8e1ffd48-620f-492d-b69d-23625a39277c/ww-lourensford-day1-gold.kml'),
        'customMarkers', jsonb_build_array(
          jsonb_build_object('id','wp1','name','Waterpoint 1 — Peninsula Power Products','description','Day 1 waterpoint supported by Peninsula Power Products','lat',-34.04473254943552,'lng',18.88729933772862,'icon','water','color','#0ea5e9','logoUrl','/__l5e/assets-v1/b5d45ff3-2427-41a5-b3d5-522e27472726/peninsula-power.png'),
          jsonb_build_object('id','wp2','name','Waterpoint 2 — Cycle Lab','description','Day 1 waterpoint supported by Cycle Lab','lat',-34.04594271824797,'lng',18.91933374810909,'icon','water','color','#0ea5e9','logoUrl','/__l5e/assets-v1/ee490988-c227-4221-9552-433cefbc1cff/cycle-lab.png'),
          jsonb_build_object('id','wp3','name','Waterpoint 3 — NutriGo','description','Day 1 waterpoint supported by NutriGo','lat',-34.02780328396192,'lng',18.9145999137269,'icon','water','color','#0ea5e9','logoUrl','/__l5e/assets-v1/be10d92e-58ef-45aa-b299-a0a95d65ef27/nutri-go.png'),
          jsonb_build_object('id','m1','name','Marshal','lat',-34.06012941238922,'lng',18.89043611658791,'icon','warning','color','#f97316'),
          jsonb_build_object('id','m2','name','Marshal','lat',-34.05751016007832,'lng',18.89586488413873,'icon','warning','color','#f97316'),
          jsonb_build_object('id','m3','name','Marshal','lat',-34.05263388064112,'lng',18.90425738463503,'icon','warning','color','#f97316')
        )
      ),
      jsonb_build_object(
        'id','d1-silver','tier','Silver','name','Silver — Day 1','distanceKm',19.1,
        'color','#64748b',
        'kmlUrls', jsonb_build_array('/__l5e/assets-v1/9f4c48b0-44de-412c-81ee-438801daafe0/ww-lourensford-day1-silver.kml'),
        'customMarkers', jsonb_build_array()
      ),
      jsonb_build_object(
        'id','d1-bronze','tier','Bronze','name','Bronze — Day 1','distanceKm',10.0,
        'color','#a0522d',
        'kmlUrls', jsonb_build_array('/__l5e/assets-v1/a74599d2-cc09-4d11-a9d6-5163bdef9685/ww-lourensford-day1-bronze.kml'),
        'customMarkers', jsonb_build_array()
      )
    )
  ),
  jsonb_build_object('id','d2','date','2026-10-18','label','Day 2','routes', jsonb_build_array())
)
WHERE id = '2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7';