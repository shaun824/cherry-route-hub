ALTER TABLE public.event_email_steps DROP CONSTRAINT IF EXISTS event_email_steps_template_name_check;
ALTER TABLE public.event_email_steps ADD CONSTRAINT event_email_steps_template_name_check CHECK (template_name = ANY (ARRAY['event-update','pe-plett-extras','sea-to-sea-pre-event','sea-to-sea-pre-event-reminder']));
ALTER TABLE public.event_email_sends DROP CONSTRAINT IF EXISTS event_email_sends_status_check;
ALTER TABLE public.event_email_sends ADD CONSTRAINT event_email_sends_status_check CHECK (status = ANY (ARRAY['sending','sent','suppressed','failed','skipped']));