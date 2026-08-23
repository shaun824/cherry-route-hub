DROP FUNCTION IF EXISTS public.my_event_team(uuid);
CREATE FUNCTION public.my_event_team(_event_id uuid)
 RETURNS TABLE(team_name text, full_name text, category text, batch text, bib_number text, is_me boolean, tent_number text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT ee.team_name
    FROM public.event_entrants ee
    JOIN public.entrants e ON e.id = ee.entrant_id
    WHERE ee.event_id = _event_id
      AND e.user_id = auth.uid()
      AND ee.team_name IS NOT NULL
      AND btrim(ee.team_name) <> ''
    LIMIT 1
  )
  SELECT ee.team_name,
         e.full_name,
         ee.category,
         ee.batch,
         ee.bib_number,
         (e.user_id IS NOT DISTINCT FROM auth.uid()) AS is_me,
         r.tent_number
  FROM public.event_entrants ee
  JOIN public.entrants e ON e.id = ee.entrant_id
  JOIN me ON lower(btrim(ee.team_name)) = lower(btrim(me.team_name))
  LEFT JOIN LATERAL (
    SELECT er.tent_number
    FROM public.event_rooming er
    WHERE er.event_id = _event_id
      AND (er.event_entrant_id = ee.id OR er.entrant_id = ee.entrant_id)
      AND er.tent_number IS NOT NULL
    LIMIT 1
  ) r ON true
  ORDER BY (e.user_id IS NOT DISTINCT FROM auth.uid()) DESC, e.full_name;
$function$;
REVOKE EXECUTE ON FUNCTION public.my_event_team(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_event_team(uuid) TO authenticated;