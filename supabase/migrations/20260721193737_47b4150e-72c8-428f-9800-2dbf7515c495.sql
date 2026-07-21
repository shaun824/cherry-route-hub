
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS faq_url text;

ALTER TABLE public.admin_qa_messages
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

ALTER TABLE public.admin_qa_messages
  ALTER COLUMN author_id DROP NOT NULL;

-- Allow bot rows (author_id IS NULL, is_bot=true) to be read by the thread's rider or an admin.
DROP POLICY IF EXISTS "qa msg read: thread owner or admin" ON public.admin_qa_messages;
CREATE POLICY "qa msg read: thread owner or admin"
  ON public.admin_qa_messages FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_qa_threads t
      WHERE t.id = admin_qa_messages.thread_id
        AND t.rider_user_id = auth.uid()
    )
  );

-- Tighten INSERT so a rider cannot forge a bot message. Bot rows are inserted by the
-- server via the service role (bypasses RLS); riders can still insert their own messages.
DROP POLICY IF EXISTS "qa msg insert: owner or admin" ON public.admin_qa_messages;
CREATE POLICY "qa msg insert: owner or admin"
  ON public.admin_qa_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    is_bot = false
    AND author_id = auth.uid()
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM public.admin_qa_threads t
        WHERE t.id = admin_qa_messages.thread_id
          AND t.rider_user_id = auth.uid()
      )
    )
  );
