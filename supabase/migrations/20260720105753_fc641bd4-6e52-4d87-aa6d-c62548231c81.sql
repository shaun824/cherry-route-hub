
-- =========================================================
-- ENTRANTS (roster uploaded from Entry Ninja / CSV)
-- =========================================================
CREATE TABLE public.entrants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  id_number_hash TEXT,
  id_number_last4 TEXT,
  phone TEXT,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX entrants_email_idx ON public.entrants (lower(email));
CREATE INDEX entrants_user_id_idx ON public.entrants (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entrants TO authenticated;
GRANT ALL ON public.entrants TO service_role;
ALTER TABLE public.entrants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage entrants" ON public.entrants
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "read own entrant" ON public.entrants
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- allow authenticated users to claim an unlinked row that matches them (server fn validates)
CREATE POLICY "claim own entrant" ON public.entrants
  FOR UPDATE TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER entrants_touch BEFORE UPDATE ON public.entrants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- EVENT_ENTRANTS (join: which entrants are in which events)
-- =========================================================
CREATE TABLE public.event_entrants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  entrant_id UUID NOT NULL REFERENCES public.entrants(id) ON DELETE CASCADE,
  category TEXT,
  batch TEXT,
  bib_number TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, entrant_id)
);
CREATE INDEX event_entrants_event_idx ON public.event_entrants (event_id);
CREATE INDEX event_entrants_entrant_idx ON public.event_entrants (entrant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_entrants TO authenticated;
GRANT ALL ON public.event_entrants TO service_role;
ALTER TABLE public.event_entrants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage event_entrants" ON public.event_entrants
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "read own event_entrants" ON public.event_entrants
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.entrants e
            WHERE e.id = event_entrants.entrant_id AND e.user_id = auth.uid())
  );

CREATE TRIGGER event_entrants_touch BEFORE UPDATE ON public.event_entrants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Helper: does the current user have an entry in this event?
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_event_entrant(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_entrants ee
    JOIN public.entrants e ON e.id = ee.entrant_id
    WHERE ee.event_id = _event_id AND e.user_id = auth.uid()
  )
$$;

-- =========================================================
-- EVENT_INFO_BLOCKS (rich per-event content for riders)
-- =========================================================
CREATE TABLE public.event_info_blocks (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  venue_address TEXT,
  venue_lat NUMERIC,
  venue_lng NUMERIC,
  map_embed_url TEXT,
  parking_notes TEXT,
  packing_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  route_description TEXT,
  distance_km NUMERIC,
  elevation_m NUMERIC,
  gpx_url TEXT,
  rules_md TEXT,
  waivers_md TEXT,
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  emergency_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_info_blocks TO authenticated;
GRANT SELECT ON public.event_info_blocks TO anon;
GRANT ALL ON public.event_info_blocks TO service_role;
ALTER TABLE public.event_info_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read event info" ON public.event_info_blocks
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage event info" ON public.event_info_blocks
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER event_info_blocks_touch BEFORE UPDATE ON public.event_info_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- EVENT_CHAT_MESSAGES (group chat per event)
-- =========================================================
CREATE TABLE public.event_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX event_chat_event_time_idx ON public.event_chat_messages (event_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_chat_messages TO authenticated;
GRANT ALL ON public.event_chat_messages TO service_role;
ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat read: entrants or admin" ON public.event_chat_messages
  FOR SELECT TO authenticated USING (
    is_admin() OR public.is_event_entrant(event_id)
  );
CREATE POLICY "chat insert: entrants or admin" ON public.event_chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid() AND (is_admin() OR public.is_event_entrant(event_id))
  );
CREATE POLICY "chat delete: author or admin" ON public.event_chat_messages
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_admin());

-- =========================================================
-- ADMIN_QA (private thread per rider per event)
-- =========================================================
CREATE TABLE public.admin_qa_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rider_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, rider_user_id)
);
CREATE INDEX admin_qa_threads_rider_idx ON public.admin_qa_threads (rider_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_qa_threads TO authenticated;
GRANT ALL ON public.admin_qa_threads TO service_role;
ALTER TABLE public.admin_qa_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa thread read: owner or admin" ON public.admin_qa_threads
  FOR SELECT TO authenticated USING (rider_user_id = auth.uid() OR is_admin());
CREATE POLICY "qa thread insert: owner or admin" ON public.admin_qa_threads
  FOR INSERT TO authenticated WITH CHECK (rider_user_id = auth.uid() OR is_admin());
CREATE POLICY "qa thread update: admin" ON public.admin_qa_threads
  FOR UPDATE TO authenticated USING (rider_user_id = auth.uid() OR is_admin()) WITH CHECK (rider_user_id = auth.uid() OR is_admin());

CREATE TRIGGER admin_qa_threads_touch BEFORE UPDATE ON public.admin_qa_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.admin_qa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.admin_qa_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_admin_msg BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_qa_messages_thread_time_idx ON public.admin_qa_messages (thread_id, created_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_qa_messages TO authenticated;
GRANT ALL ON public.admin_qa_messages TO service_role;
ALTER TABLE public.admin_qa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa msg read: thread owner or admin" ON public.admin_qa_messages
  FOR SELECT TO authenticated USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.admin_qa_threads t
      WHERE t.id = admin_qa_messages.thread_id AND t.rider_user_id = auth.uid()
    )
  );
CREATE POLICY "qa msg insert: owner or admin" ON public.admin_qa_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid() AND (
      is_admin() OR EXISTS (
        SELECT 1 FROM public.admin_qa_threads t
        WHERE t.id = admin_qa_messages.thread_id AND t.rider_user_id = auth.uid()
      )
    )
  );
CREATE POLICY "qa msg delete: author or admin" ON public.admin_qa_messages
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_admin());

-- =========================================================
-- PACKING_CHECKLIST_STATE (per-rider tick state)
-- =========================================================
CREATE TABLE public.packing_checklist_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id, item_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_checklist_state TO authenticated;
GRANT ALL ON public.packing_checklist_state TO service_role;
ALTER TABLE public.packing_checklist_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own checklist" ON public.packing_checklist_state
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_qa_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_qa_threads;
