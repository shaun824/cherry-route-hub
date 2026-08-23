DROP INDEX IF EXISTS public.event_price_book_unique;
ALTER TABLE public.event_price_book
  ADD CONSTRAINT event_price_book_event_kind_label_key UNIQUE (event_id, kind, label);