alter table public.event_village_maps add column if not exists venue_id uuid references public.event_venues(id) on delete cascade;
alter table public.event_village_maps add column if not exists id uuid not null default gen_random_uuid();
alter table public.event_village_maps drop constraint if exists event_village_maps_pkey;
alter table public.event_village_maps add constraint event_village_maps_pkey primary key (id);
create unique index if not exists event_village_maps_event_venue_uniq
  on public.event_village_maps (event_id, coalesce(venue_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.event_village_tents add column if not exists venue_id uuid references public.event_venues(id) on delete cascade;
create index if not exists event_village_tents_event_venue_idx on public.event_village_tents (event_id, venue_id);

alter table public.event_village_tent_rules add column if not exists venue_id uuid references public.event_venues(id) on delete cascade;
create index if not exists event_village_tent_rules_event_venue_idx on public.event_village_tent_rules (event_id, venue_id);

insert into public.event_venues (event_id, name, address, notes, sort_order)
select e.id, v.name, v.address, v.notes, v.sort_order
from public.events e
cross join (values
  ('St Francis Links', 'St Francis Links, St Francis Bay, Eastern Cape', 'Day 1 race village', 0),
  ('Fynbos Ridge', 'Fynbos Ridge Country House, N2, Plettenberg Bay', 'Race village', 2),
  ('Tsitsikamma Lodge and Spa', 'Tsitsikamma Lodge & Spa, N2, Storms River', 'Race village', 1)
) as v(name, address, notes, sort_order)
where e.name ilike '%PE PLETT 2027%'
  and not exists (
    select 1 from public.event_venues ev where ev.event_id = e.id and lower(ev.name) = lower(v.name)
  );

insert into public.event_village_maps (event_id, venue_id, intro, hotspots, geo, zones)
select ev.event_id, ev.id,
  null,
  '[]'::jsonb,
  case
    when ev.name = 'St Francis Links' then '{"lat":-34.1544,"lng":24.8447,"widthM":0}'::jsonb
    when ev.name = 'Tsitsikamma Lodge and Spa' then '{"lat":-33.9799,"lng":23.8940,"widthM":0}'::jsonb
    else '{"lat":-34.039020,"lng":23.294378,"widthM":0}'::jsonb
  end,
  '[]'::jsonb
from public.event_venues ev
join public.events e on e.id = ev.event_id
where e.name ilike '%PE PLETT 2027%'
  and ev.name in ('St Francis Links', 'Fynbos Ridge', 'Tsitsikamma Lodge and Spa')
  and not exists (
    select 1 from public.event_village_maps m where m.event_id = ev.event_id and m.venue_id = ev.id
  );