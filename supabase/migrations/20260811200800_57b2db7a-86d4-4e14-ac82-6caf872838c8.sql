CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
ALTER FUNCTION public.is_admin() SET SCHEMA private;
ALTER FUNCTION public.is_event_entrant(uuid) SET SCHEMA private;

ALTER FUNCTION private.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION private.is_admin() SET search_path = public;
ALTER FUNCTION private.is_event_entrant(uuid) SET search_path = public;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_event_entrant(uuid) TO anon, authenticated, service_role;