ALTER TABLE public.event_email_steps
ADD COLUMN IF NOT EXISTS template_name text NOT NULL DEFAULT 'event-update';

ALTER TABLE public.event_email_steps
ADD CONSTRAINT event_email_steps_template_name_check
CHECK (template_name IN ('event-update', 'pe-plett-extras'));