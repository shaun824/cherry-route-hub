create or replace function public.live_tracking_identity(_event_id uuid)
returns table(entrant_id uuid, full_name text, bib_number text, category text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (tp.entrant_id)
         tp.entrant_id, e.full_name, ee.bib_number, ee.category
  from public.tracking_points tp
  join public.entrants e on e.id = tp.entrant_id
  left join public.event_entrants ee
    on ee.event_id = tp.event_id and ee.entrant_id = tp.entrant_id
  where tp.event_id = _event_id
    and tp.entrant_id is not null
    and tp.recorded_at > now() - interval '12 hours';
$$;

grant execute on function public.live_tracking_identity(uuid) to anon, authenticated;