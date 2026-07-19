
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site settings are viewable by everyone"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete site settings"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_settings_touch
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.site_settings (key, value) VALUES
  ('branding', '{
    "appName": "Red Cherry Events",
    "tagline": "Rider Hub",
    "welcomeMessage": "Welcome back,",
    "eyebrow": "Red Cherry"
  }'::jsonb),
  ('quick_links', '{
    "items": [
      { "id": "ql_news", "label": "News", "to": "/feed", "icon": "Newspaper", "enabled": true },
      { "id": "ql_events", "label": "Events", "to": "/events", "icon": "MapPin", "enabled": true },
      { "id": "ql_gallery", "label": "Gallery", "to": "/gallery", "icon": "Image", "enabled": true },
      { "id": "ql_promos", "label": "Promos", "to": "/promos", "icon": "Tag", "enabled": true }
    ]
  }'::jsonb),
  ('waivers', '{
    "waiverText": "I accept the indemnity & liability waiver for this event and confirm I''m medically fit to ride.",
    "termsText": "I agree to the Red Cherry Events terms and Entry Ninja processing of my data.",
    "waiverFullText": "By entering this event, riders acknowledge the inherent risks of cycling and release Red Cherry Events, its partners, sponsors and volunteers from liability for any injury, loss or damage sustained during the event.",
    "termsFullText": "Red Cherry Events processes your data solely to facilitate your entry, communications and race results, including sharing necessary details with Entry Ninja for entry management."
  }'::jsonb);
