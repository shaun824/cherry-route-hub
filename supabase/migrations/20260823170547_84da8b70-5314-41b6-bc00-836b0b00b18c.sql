create or replace function public.my_entry_group(_event_id uuid)
returns table(
  group_ref text,
  full_name text,
  category text,
  is_me boolean,
  paid boolean,
  amount_due_cents integer,
  amount_paid_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select coalesce(nullif(btrim(ee.registration_ref), ''), nullif(btrim(ee.team_ref), '')) as gref
    from public.event_entrants ee
    join public.entrants e on e.id = ee.entrant_id
    where ee.event_id = _event_id
      and e.user_id = auth.uid()
      and coalesce(nullif(btrim(ee.registration_ref), ''), nullif(btrim(ee.team_ref), '')) is not null
    limit 1
  )
  select me.gref,
         e.full_name,
         ee.category,
         (e.user_id is not distinct from auth.uid()) as is_me,
         ee.paid,
         ee.amount_due_cents,
         ee.amount_paid_cents
  from public.event_entrants ee
  join public.entrants e on e.id = ee.entrant_id
  join me on me.gref = coalesce(nullif(btrim(ee.registration_ref), ''), nullif(btrim(ee.team_ref), ''))
  where ee.event_id = _event_id
  order by (e.user_id is not distinct from auth.uid()) desc, e.full_name;
$$;

revoke all on function public.my_entry_group(uuid) from public;
grant execute on function public.my_entry_group(uuid) to authenticated;