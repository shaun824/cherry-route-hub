ALTER TABLE public.admin_qa_threads ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE public.admin_qa_threads ADD COLUMN IF NOT EXISTS guest_key text;
CREATE INDEX IF NOT EXISTS admin_qa_threads_guest_key_idx ON public.admin_qa_threads (guest_key);