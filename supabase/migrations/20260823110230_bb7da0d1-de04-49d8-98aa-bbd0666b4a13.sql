create table if not exists public.event_social_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  platform text not null default 'instagram',
  post_url text not null,
  caption text,
  thumbnail_url text,
  posted_at timestamptz,
  sort_index int not null default 0,
  active boolean not null default true,
  source text,
  created_at timestamptz not null default now()
);

create unique index if not exists event_social_posts_url_event_idx
  on public.event_social_posts (coalesce(event_id::text, 'global'), post_url);

grant select on public.event_social_posts to anon, authenticated;
grant all on public.event_social_posts to service_role;

alter table public.event_social_posts enable row level security;

drop policy if exists "Social posts are public" on public.event_social_posts;
create policy "Social posts are public" on public.event_social_posts
for select using (active);

drop policy if exists "Admins manage social posts" on public.event_social_posts;
create policy "Admins manage social posts" on public.event_social_posts
for all to authenticated
using (private.has_role(auth.uid(), 'admin'::app_role))
with check (private.has_role(auth.uid(), 'admin'::app_role));

update public.events set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
  'instagram','https://www.instagram.com/tour_de_addo/','facebook','https://www.facebook.com/Tourdeaddo')
where name ilike 'Tour de Addo%';

update public.events set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
  'instagram','https://www.instagram.com/pe_plett/')
where name ilike '%PE PLETT%';

update public.events set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
  'instagram','https://www.instagram.com/innercityenduro/','facebook','https://www.facebook.com/innercityenduro/')
where name ilike '%Inner City Enduro%';

update public.events set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
  'instagram','https://www.instagram.com/sea_to_sea_za/','facebook','https://www.facebook.com/seatoseaepic')
where name ilike '%Sea to Sea%';

update public.events set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
  'instagram','https://www.instagram.com/weekend_warriormtb/','facebook','https://www.facebook.com/RCAweekendwarrior/')
where name ilike '%Weekend Warrior%';

update public.events set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
  'facebook','https://www.facebook.com/rallyeraidoffroad')
where name ilike '%Rallye Raid%';

update public.events set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
  'instagram','https://www.instagram.com/redcherryevents_za/','facebook','https://www.facebook.com/redcherryeventsza')
where (social_links->>'instagram') is null and (social_links->>'facebook') is null;
