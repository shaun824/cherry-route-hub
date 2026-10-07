ALTER TABLE public.event_chat_messages ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS share_whatsapp boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.chat_author_whatsapp(_message_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.phone FROM public.event_chat_messages m JOIN public.profiles p ON p.id = m.author_id
  WHERE m.id = _message_id AND m.share_whatsapp
    AND (private.is_admin() OR private.is_event_entrant(m.event_id));
$$;
REVOKE ALL ON FUNCTION public.chat_author_whatsapp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_author_whatsapp(uuid) TO authenticated;