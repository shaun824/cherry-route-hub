
-- profiles
DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

-- user_roles
DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- feed_posts / promos / sponsors: admin write policies (readable by anon already)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['feed_posts','promos','sponsors'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admins write %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "admins write %I" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
  END LOOP;
END $$;
