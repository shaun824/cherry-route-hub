alter table public.loyalty_event_values
  add column if not exists entry_price_cents integer,
  add column if not exists hero boolean not null default false,
  add column if not exists price_source text;

alter table public.loyalty_coupons
  add column if not exists en_status text not null default 'not_sent',
  add column if not exists en_ref text,
  add column if not exists en_event_id integer,
  add column if not exists en_pushed_at timestamptz,
  add column if not exists en_error text;