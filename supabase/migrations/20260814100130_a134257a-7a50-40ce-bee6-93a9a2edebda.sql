-- Push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  failure_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per-rider notification preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  news boolean NOT NULL DEFAULT true,
  event_reminders boolean NOT NULL DEFAULT true,
  safety boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification prefs" ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notification_preferences_touch BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sent notifications (admin composed / automated)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  image_url text,
  audience text NOT NULL DEFAULT 'all',
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  batch text,
  urgent boolean NOT NULL DEFAULT false,
  channels text[] NOT NULL DEFAULT ARRAY['push']::text[],
  source text NOT NULL DEFAULT 'manual',
  dedupe_key text UNIQUE,
  created_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipients_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0
);
CREATE INDEX notifications_sent_at_idx ON public.notifications(sent_at DESC);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read notifications" ON public.notifications FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Per-recipient delivery log
CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid,
  subscription_id uuid,
  channel text NOT NULL DEFAULT 'push',
  status text NOT NULL DEFAULT 'sent',
  error text,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_deliveries_notification_idx ON public.notification_deliveries(notification_id);
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read deliveries" ON public.notification_deliveries FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));