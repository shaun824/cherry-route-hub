create table if not exists public.content_audit_resolutions (
  issue_key text primary key,
  status text not null default 'dismissed',
  area text,
  event_id uuid references public.events(id) on delete cascade,
  message text,
  note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz not null default now()
);

grant select, insert, update, delete on public.content_audit_resolutions to authenticated;
grant all on public.content_audit_resolutions to service_role;

alter table public.content_audit_resolutions enable row level security;

create policy "Admins manage audit resolutions"
on public.content_audit_resolutions for all to authenticated
using (private.has_role(auth.uid(), 'admin'::app_role))
with check (private.has_role(auth.uid(), 'admin'::app_role));

select cron.alter_job(5, schedule => '0 3 * * *');