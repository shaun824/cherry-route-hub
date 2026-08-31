UPDATE public.entrants e
SET user_id = p.id
FROM public.profiles p
WHERE e.user_id IS NULL
  AND e.email IS NOT NULL
  AND lower(btrim(e.email)) = lower(btrim(p.email));