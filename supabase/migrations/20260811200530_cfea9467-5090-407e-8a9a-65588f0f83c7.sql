-- 1) Entrants: remove the permissive "claim any unclaimed row" update policy.
DROP POLICY IF EXISTS "claim own entrant" ON public.entrants;

CREATE POLICY "update own entrant"
ON public.entrants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2) Role helper: only answer for the calling user (or trusted server role).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    case
      when _user_id is null then false
      when auth.uid() is not null and _user_id <> auth.uid() then false
      else exists (
        select 1 from public.user_roles
        where user_id = _user_id and role = _role
      )
    end
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_event_entrant(uuid) FROM anon;