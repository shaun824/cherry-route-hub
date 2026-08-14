CREATE POLICY "crew read event_entrants" ON public.event_entrants
  FOR SELECT TO authenticated USING (private.is_crew());

CREATE POLICY "crew read entrants" ON public.entrants
  FOR SELECT TO authenticated USING (private.is_crew());