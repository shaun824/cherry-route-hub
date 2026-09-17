CREATE OR REPLACE FUNCTION public.live_tracking_identity_v2(_event_id uuid)
 RETURNS TABLE(entrant_id uuid, full_name text, bib_number text, category text, batch text, finished_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (tp.entrant_id)
         tp.entrant_id, e.full_name, ee.bib_number, ee.category, ee.batch, ee.finished_at
  from public.tracking_points tp
  join public.entrants e on e.id = tp.entrant_id
  left join public.event_entrants ee
    on ee.event_id = tp.event_id and ee.entrant_id = tp.entrant_id
  where tp.event_id = _event_id
    and tp.entrant_id is not null
    and tp.recorded_at > now() - interval '24 hours';
$function$;

GRANT EXECUTE ON FUNCTION public.live_tracking_identity_v2(uuid) TO anon, authenticated, service_role;