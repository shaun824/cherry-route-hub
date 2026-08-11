ALTER TABLE public.event_merch_options DROP CONSTRAINT IF EXISTS event_merch_options_event_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS event_merch_options_event_en_item_key
  ON public.event_merch_options(event_id, en_item_id)
  WHERE en_item_id IS NOT NULL;