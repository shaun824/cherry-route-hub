CREATE OR REPLACE FUNCTION public.live_tracking_sos_flags(_event_id uuid)
 RETURNS TABLE(user_id uuid, reason text, status text, created_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.user_id, s.reason, s.status, s.created_at
  from public.tracking_sos s
  where s.event_id = _event_id
    and s.status in ('active','acknowledged')
    and s.created_at > now() - interval '24 hours';
$function$;

GRANT EXECUTE ON FUNCTION public.live_tracking_sos_flags(uuid) TO anon, authenticated, service_role;