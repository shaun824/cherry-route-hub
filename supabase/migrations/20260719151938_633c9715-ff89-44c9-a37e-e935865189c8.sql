
-- Make is_admin SECURITY DEFINER for consistency with has_role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$function$;

-- Drop duplicate admin policy on feed_posts; keep the has_role-based one
DROP POLICY IF EXISTS "admins write feed_posts" ON public.feed_posts;
