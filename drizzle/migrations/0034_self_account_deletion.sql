ALTER TABLE public.entries ALTER COLUMN user_id DROP NOT NULL;
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid='public.entries'::regclass AND contype='f'
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.entries'::regclass AND attname='user_id')]::smallint[];
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.entries DROP CONSTRAINT %I', c); END IF;
END $$;
ALTER TABLE public.entries ADD CONSTRAINT entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.prepare_account_deletion(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Missing user'; END IF;
  DELETE FROM public.tracking_points WHERE user_id=_user_id;
  DELETE FROM public.tracking_sos WHERE user_id=_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id=_user_id;
  DELETE FROM public.notification_preferences WHERE user_id=_user_id;
  DELETE FROM public.notification_deliveries WHERE user_id=_user_id;
  DELETE FROM public.rider_favourites WHERE user_id=_user_id;
  DELETE FROM public.rider_event_history WHERE user_id=_user_id;
  DELETE FROM public.strava_segment_efforts WHERE user_id=_user_id;
  DELETE FROM public.strava_connections WHERE user_id=_user_id;
  DELETE FROM public.packing_checklist_state WHERE user_id=_user_id;
  DELETE FROM public.learn_completions WHERE user_id=_user_id;
  DELETE FROM public.learn_progress WHERE user_id=_user_id;
  DELETE FROM public.learn_quiz_attempts WHERE user_id=_user_id;
  DELETE FROM public.crew_task_state WHERE user_id=_user_id;
  DELETE FROM public.crew_department_assignments WHERE user_id=_user_id;
  DELETE FROM public.crew_waivers WHERE user_id=_user_id;
  DELETE FROM public.event_chat_messages WHERE author_id=_user_id;
  DELETE FROM public.admin_qa_threads WHERE rider_user_id=_user_id;
  DELETE FROM public.admin_qa_messages WHERE author_id=_user_id;
  DELETE FROM public.analytics_events WHERE user_id=_user_id;
  DELETE FROM public.feedback WHERE user_id=_user_id;
  IF to_regclass('public.native_push_tokens') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.native_push_tokens WHERE user_id=$1' USING _user_id;
  END IF;

  UPDATE public.entries SET user_id=NULL WHERE user_id=_user_id;
  UPDATE public.entrants SET user_id=NULL, phone=NULL, id_number_hash=NULL, id_number_last4=NULL WHERE user_id=_user_id;
  UPDATE public.tracking_sos SET acknowledged_by=NULL WHERE acknowledged_by=_user_id;
  UPDATE public.tracking_sos SET resolved_by=NULL WHERE resolved_by=_user_id;
  UPDATE public.content_audit_resolutions SET resolved_by=NULL WHERE resolved_by=_user_id;
  UPDATE public.packing_suggestions SET created_by=NULL WHERE created_by=_user_id;
  UPDATE public.packing_suggestions SET reviewed_by=NULL WHERE reviewed_by=_user_id;

  DELETE FROM public.user_roles WHERE user_id=_user_id;
  DELETE FROM public.profiles WHERE id=_user_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) TO service_role;