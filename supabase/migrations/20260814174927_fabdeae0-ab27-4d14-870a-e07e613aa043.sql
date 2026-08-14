CREATE OR REPLACE FUNCTION private.is_crew()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('crew','admin')
  )
$$;

ALTER TABLE public.event_venues ADD COLUMN IF NOT EXISTS village_spot_id text;
ALTER TABLE public.event_rooming ADD COLUMN IF NOT EXISTS location_hint text;

DROP POLICY IF EXISTS "crew read rooming" ON public.event_rooming;
CREATE POLICY "crew read rooming" ON public.event_rooming
FOR SELECT TO authenticated
USING (private.is_crew());