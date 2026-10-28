ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_review_event boolean NOT NULL DEFAULT false;

-- True when the signed-in user is an admin or has an entry on the event.
CREATE OR REPLACE FUNCTION private.can_see_review_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.entries WHERE event_id = _event_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_entrants ee JOIN public.entrants e ON e.id = ee.entrant_id
               WHERE ee.event_id = _event_id AND e.user_id = auth.uid())
  )
$$;

-- True when the event is a normal event, or the caller may see the review event.
CREATE OR REPLACE FUNCTION private.event_visible(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT COALESCE((SELECT is_review_event FROM public.events WHERE id = _event_id), false)
         OR private.can_see_review_event(_event_id)
$$;

GRANT EXECUTE ON FUNCTION private.can_see_review_event(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.event_visible(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "public read events" ON public.events;
CREATE POLICY "public read events" ON public.events FOR SELECT TO anon, authenticated
  USING (NOT is_review_event OR private.can_see_review_event(id));

DROP POLICY IF EXISTS "public read results" ON public.event_results;
CREATE POLICY "public read results" ON public.event_results FOR SELECT TO public
  USING (private.event_visible(event_id));

DROP POLICY IF EXISTS "public read result sets" ON public.event_result_sets;
CREATE POLICY "public read result sets" ON public.event_result_sets FOR SELECT TO public
  USING (private.event_visible(event_id));

-- Review SOS alerts are logged as "test" and never treated as live.
CREATE OR REPLACE FUNCTION public.live_tracking_sos_flags_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT is_review_event FROM public.events WHERE id = NEW.event_id) AND NEW.status IN ('active','acknowledged','open') THEN
    NEW.status := 'test';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tracking_sos_review_test ON public.tracking_sos;
CREATE TRIGGER tracking_sos_review_test BEFORE INSERT ON public.tracking_sos
  FOR EACH ROW EXECUTE FUNCTION public.live_tracking_sos_flags_guard();
REVOKE EXECUTE ON FUNCTION public.live_tracking_sos_flags_guard() FROM anon, authenticated;