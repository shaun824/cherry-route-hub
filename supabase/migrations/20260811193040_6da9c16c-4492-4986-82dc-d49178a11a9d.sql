CREATE TABLE public.event_merch_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  en_item_id bigint,
  name text not null,
  options jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name)
);

CREATE INDEX event_merch_options_event_idx ON public.event_merch_options(event_id);

GRANT SELECT ON public.event_merch_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_merch_options TO authenticated;
GRANT ALL ON public.event_merch_options TO service_role;

ALTER TABLE public.event_merch_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merch options readable" ON public.event_merch_options FOR SELECT USING (true);
CREATE POLICY "admins manage merch options" ON public.event_merch_options FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER event_merch_options_touch BEFORE UPDATE ON public.event_merch_options FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();