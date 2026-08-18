ALTER TABLE public.event_entrants
  ADD COLUMN IF NOT EXISTS team_name text,
  ADD COLUMN IF NOT EXISTS team_ref text;

CREATE INDEX IF NOT EXISTS event_entrants_team_idx
  ON public.event_entrants (event_id, lower(team_name));

CREATE OR REPLACE FUNCTION public.my_event_team(_event_id uuid)
RETURNS TABLE (
  team_name text,
  full_name text,
  category text,
  batch text,
  bib_number text,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT ee.team_name, ee.entrant_id
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
         (e.user_id IS NOT DISTINCT FROM auth.uid()) AS is_me
  FROM public.event_entrants ee
  JOIN public.entrants e ON e.id = ee.entrant_id
  JOIN me ON lower(btrim(ee.team_name)) = lower(btrim(me.team_name))
  WHERE ee.event_id = _event_id
  ORDER BY e.full_name;
$$;

REVOKE ALL ON FUNCTION public.my_event_team(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.my_event_team(uuid) TO authenticated;