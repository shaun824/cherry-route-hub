DO $$
DECLARE
  ev uuid := '003c81de-59a6-4165-9d41-9699fa0d4b32';
  my_entrant uuid := '8f7585c6-8f85-4e1b-a2b8-416a4b06bcb5';
  my_ee uuid := 'c2526680-5ee6-45b2-a443-3c6e4589f089';
  team text := 'Cherry Bombers';
  tref text := '9990001';
  rec record;
  new_entrant uuid;
  new_ee uuid;
BEGIN
  UPDATE public.event_entrants
     SET team_name = team, team_ref = tref, batch = COALESCE(NULLIF(batch,''),'The Ride'), bib_number = COALESCE(NULLIF(bib_number,''),'RC01')
   WHERE id = my_ee;

  INSERT INTO public.event_rooming (event_id, entrant_id, event_entrant_id, full_name, email, tent_number, room_type, match_source)
  SELECT ev, my_entrant, my_ee, 'Emil den Dulk', 'shaun@redcherryevents.co.za', 'T12', 'Single Chalet', 'manual'
  WHERE NOT EXISTS (SELECT 1 FROM public.event_rooming WHERE event_id = ev AND event_entrant_id = my_ee);

  FOR rec IN
    SELECT * FROM (VALUES
      ('Danie van Wyk','danie.vanwyk@example.com','RC02','T12','Double Luxury Tent Package'),
      ('Lerato Mokoena','lerato.mokoena@example.com','RC03','T13','Double Luxury Tent Package'),
      ('Craig Bennett','craig.bennett@example.com','RC04','T13','Double Luxury Tent Package')
    ) AS t(full_name, email, bib, tent, room_type)
  LOOP
    SELECT id INTO new_entrant FROM public.entrants WHERE lower(email) = rec.email LIMIT 1;
    IF new_entrant IS NULL THEN
      INSERT INTO public.entrants (full_name, email, notes)
      VALUES (rec.full_name, rec.email, 'Demo teammate for testing')
      RETURNING id INTO new_entrant;
    END IF;

    INSERT INTO public.event_entrants (event_id, entrant_id, category, batch, bib_number, team_name, team_ref, notes)
    VALUES (ev, new_entrant, 'Double Luxury Tent Package', 'The Ride', rec.bib, team, tref, 'Demo teammate for testing')
    ON CONFLICT (event_id, entrant_id) DO UPDATE
      SET team_name = EXCLUDED.team_name, team_ref = EXCLUDED.team_ref, bib_number = EXCLUDED.bib_number, batch = EXCLUDED.batch
    RETURNING id INTO new_ee;

    INSERT INTO public.event_rooming (event_id, entrant_id, event_entrant_id, full_name, email, tent_number, room_type, match_source)
    SELECT ev, new_entrant, new_ee, rec.full_name, rec.email, rec.tent, rec.room_type, 'manual'
    WHERE NOT EXISTS (SELECT 1 FROM public.event_rooming WHERE event_id = ev AND event_entrant_id = new_ee);
  END LOOP;
END $$;