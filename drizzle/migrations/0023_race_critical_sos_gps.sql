-- New SOS alerts are live by default (old default 'open' was invisible to race control).
ALTER TABLE public.tracking_sos ALTER COLUMN status SET DEFAULT 'active';
-- Old stuck test alerts left in 'open' are closed so they don't sound the alarm.
UPDATE public.tracking_sos SET status = 'cancelled' WHERE status = 'open';

-- GPS history is no longer publicly readable; the live map reads it server-side.
DROP POLICY IF EXISTS "Anyone can view tracking points" ON public.tracking_points;
REVOKE SELECT ON public.tracking_points FROM anon;
CREATE POLICY "Riders view their own tracking points" ON public.tracking_points
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Crew and admins view tracking points" ON public.tracking_points
  FOR SELECT TO authenticated USING (private.is_admin() OR private.is_crew());

-- Weekend Warrior Lourensford: first start is 12:25 SAST on Day 1, not 07:00.
UPDATE public.events SET event_date = '2026-10-17 10:25:00+00' WHERE id = '2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7';