-- Store-app push tokens (Firebase Cloud Messaging), one row per phone.
-- Apply once (ask Lovable: "run the SQL in native/sql/native_push_tokens.sql").
-- Only the server (service role) reads or writes this table.

create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  user_agent text,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists native_push_tokens_user_id_idx on public.native_push_tokens (user_id);

alter table public.native_push_tokens enable row level security;
-- No policies on purpose: anon / authenticated clients get no access.
