CREATE OR REPLACE FUNCTION public.my_registration_members()
RETURNS TABLE(event_id uuid, event_name text, event_date timestamptz, group_ref text, full_name text, category text, batch text, bib_number text, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  with mine as (
    select distinct ee.event_id,
      coalesce(nullif(btrim(ee.registration_ref), ''), nullif(btrim(ee.team_ref), '')) as gref
    from public.event_entrants ee
    join public.entrants e on e.id = ee.entrant_id
    where e.user_id = auth.uid()
      and coalesce(nullif(btrim(ee.registration_ref), ''), nullif(btrim(ee.team_ref), '')) is not null
  )
  select ee.event_id, ev.name, ev.event_date::timestamptz, mine.gref, e.full_name, ee.category, ee.batch, ee.bib_number,
         (e.user_id is not distinct from auth.uid())
  from public.event_entrants ee
  join public.entrants e on e.id = ee.entrant_id
  join public.events ev on ev.id = ee.event_id
  join mine on mine.event_id = ee.event_id
    and mine.gref = coalesce(nullif(btrim(ee.registration_ref), ''), nullif(btrim(ee.team_ref), ''))
  order by ev.event_date, (e.user_id is not distinct from auth.uid()) desc, e.full_name;
$$;
REVOKE ALL ON FUNCTION public.my_registration_members() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_registration_members() TO authenticated;