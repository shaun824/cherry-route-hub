alter table public.event_faq_learned
  add column if not exists follow_ups text[] not null default '{}',
  add column if not exists source_kind text not null default 'admin_answer';