INSERT INTO public.user_roles (user_id, role)
SELECT id, 'crew'::public.app_role FROM public.profiles WHERE email IN ('shaun.glover49@gmail.com','siya@redcherryevents.co.za')
ON CONFLICT (user_id, role) DO NOTHING;