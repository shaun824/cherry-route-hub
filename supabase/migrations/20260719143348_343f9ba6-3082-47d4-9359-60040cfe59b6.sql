
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'rider');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  tshirt_size text,
  jacket_size text,
  entry_ninja_id text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + auto-promote admin on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rider')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF lower(NEW.email) = 'shaun@redcherryevents.co.za' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also promote on email confirmation (in case created before confirmation)
CREATE OR REPLACE FUNCTION public.grant_admin_on_confirm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'shaun@redcherryevents.co.za' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_confirmed
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_on_confirm();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EVENTS ============
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  discipline text NOT NULL,
  event_date timestamptz NOT NULL,
  location text NOT NULL,
  distance_km integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  entry_ninja_id text,
  entry_ninja_url text,
  description text,
  hero_color text,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  map_query text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read events" ON public.events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write events" ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER events_touch BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ FEED POSTS ============
CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type text NOT NULL DEFAULT 'news',
  title text NOT NULL,
  body text NOT NULL,
  author text NOT NULL DEFAULT 'Red Cherry Events',
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  pinned boolean NOT NULL DEFAULT false,
  posted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feed_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read feed" ON public.feed_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write feed" ON public.feed_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER feed_touch BEFORE UPDATE ON public.feed_posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PROMOS ============
CREATE TABLE public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  title text NOT NULL,
  code text NOT NULL,
  discount text NOT NULL,
  expires date,
  accent text NOT NULL DEFAULT 'oklch(0.55 0.2 25)',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promos TO authenticated;
GRANT ALL ON public.promos TO service_role;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read promos" ON public.promos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write promos" ON public.promos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER promos_touch BEFORE UPDATE ON public.promos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SPONSORS ============
CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'Bronze',
  logo_text text NOT NULL,
  accent text NOT NULL DEFAULT 'oklch(0.55 0.2 25)',
  url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sponsors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sponsors" ON public.sponsors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write sponsors" ON public.sponsors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sponsors_touch BEFORE UPDATE ON public.sponsors
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ENTRIES ============
CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  tshirt_size text,
  jacket_size text,
  merch jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cents integer NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_ref text,
  entry_ninja_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own entries" ON public.entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own entries" ON public.entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own entries" ON public.entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all entries" ON public.entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage all entries" ON public.entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER entries_touch BEFORE UPDATE ON public.entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SEED ============
INSERT INTO public.events (slug, name, discipline, event_date, location, distance_km, status, entry_ninja_id, description, hero_color, schedule, map_query) VALUES
  ('cherry-classic-100', 'Cherry Classic 100', 'Road Cycling', '2026-08-02T06:30:00Z', 'Stellenbosch, WC', 100, 'open', 'en_evt_00812',
   'A fast, rolling 100km road race through the Cape Winelands. Neutral start from Coetzenburg with three timed KOM sectors.',
   'from-[oklch(0.55_0.23_25)] to-[oklch(0.4_0.18_20)]',
   '[{"time":"05:30","label":"Registration & number collection"},{"time":"06:30","label":"Neutral roll-out"},{"time":"07:00","label":"KOM Sector 1 — Helshoogte"},{"time":"10:30","label":"Estimated finish window"},{"time":"12:00","label":"Prize giving"}]'::jsonb,
   'Coetzenburg Stadium Stellenbosch'),
  ('karoo-gravel-grinder', 'Karoo Gravel Grinder', 'Gravel', '2026-09-14T05:45:00Z', 'Prince Albert, WC', 165, 'open', 'en_evt_00815',
   '165km of pure Karoo gravel with two neutral water points. Self-sufficiency required between P2 and P3.',
   'from-[oklch(0.5_0.14_60)] to-[oklch(0.35_0.1_40)]',
   '[{"time":"05:00","label":"Race village opens"},{"time":"05:45","label":"Mass start"},{"time":"08:30","label":"Water point 1"},{"time":"14:00","label":"Cut-off — P3"}]'::jsonb,
   'Prince Albert Karoo'),
  ('cherry-night-crit', 'Cherry Night Crit', 'Criterium', '2026-07-25T18:00:00Z', 'V&A Waterfront, CT', 30, 'live', 'en_evt_00819',
   '45-minute + 5 lap criterium under floodlights. Cat A, B and women''s races back-to-back.',
   'from-[oklch(0.45_0.18_15)] to-[oklch(0.28_0.12_20)]',
   '[{"time":"17:15","label":"Course open for warm-up"},{"time":"18:00","label":"Women''s A + Men''s C"},{"time":"19:15","label":"Men''s A + B"}]'::jsonb,
   'V&A Waterfront Cape Town'),
  ('table-mountain-mtb-shootout', 'Table Mountain MTB Shootout', 'MTB', '2026-10-05T07:00:00Z', 'Tokai Forest, CT', 65, 'upcoming', 'en_evt_00821',
   'Technical singletrack shootout with 1,800m of climbing. Full-suspension recommended.',
   'from-[oklch(0.42_0.09_150)] to-[oklch(0.28_0.06_150)]',
   '[{"time":"06:00","label":"Bike check-in"},{"time":"07:00","label":"Elite wave start"},{"time":"07:10","label":"General waves"}]'::jsonb,
   'Tokai Forest Cape Town');

INSERT INTO public.feed_posts (post_type, title, body, author, pinned, posted_at, event_id)
SELECT 'weather', 'Weather warning — Cherry Classic 100',
  'Strong SE wind expected from 09:00, gusting 45km/h on the Franschhoek Pass descent. Ride to the conditions and hold your line through the crosswind section at KM72.',
  'Race Control', true, '2026-07-19T08:12:00Z', e.id
FROM public.events e WHERE e.slug = 'cherry-classic-100';

INSERT INTO public.feed_posts (post_type, title, body, author, posted_at, event_id)
SELECT 'notice', 'Number collection extended to 20:00',
  'Number collection for the Night Crit has been extended tonight. Bring your ID and Entry Ninja confirmation email.',
  'Red Cherry Ops', '2026-07-19T06:40:00Z', e.id
FROM public.events e WHERE e.slug = 'cherry-night-crit';

INSERT INTO public.feed_posts (post_type, title, body, author, posted_at, event_id)
SELECT 'update', 'Route change: KM 42 detour',
  'Due to road works on the R310, we''re rerouting via Blaauwklippen. Adds 1.2km. Updated GPX has been pushed to your device.',
  'Race Director', '2026-07-18T17:22:00Z', e.id
FROM public.events e WHERE e.slug = 'cherry-classic-100';

INSERT INTO public.feed_posts (post_type, title, body, author, posted_at, event_id)
SELECT 'news', 'Karoo Gravel entries now open',
  '165km of unfiltered Karoo. Early bird pricing until 31 July via Entry Ninja. Loyalty Gold+ members get priority start pens.',
  'Red Cherry Events', '2026-07-17T12:00:00Z', e.id
FROM public.events e WHERE e.slug = 'karoo-gravel-grinder';

INSERT INTO public.feed_posts (post_type, title, body, author, posted_at) VALUES
  ('news', 'New: live rider tracking',
   'From this weekend, family and supporters can follow you live on the tracker map. Enable location in your profile.',
   'Red Cherry Events', '2026-07-16T09:00:00Z');

INSERT INTO public.promos (brand, title, code, discount, expires, accent) VALUES
  ('Torq Nutrition', '20% off race day fuel', 'CHERRY20', '20%', '2026-08-31', 'oklch(0.6 0.18 25)'),
  ('Cape Cycle Systems', 'Free race-day bike check', 'RCE-TUNE', 'Free', '2026-09-15', 'oklch(0.5 0.12 240)'),
  ('Oakley SA', 'R500 off Sutro / Radar EV', 'RIDECHERRY', 'R500', '2026-10-01', 'oklch(0.4 0.08 260)');

INSERT INTO public.sponsors (name, tier, logo_text, accent, url, sort_order) VALUES
  ('Torq Nutrition', 'Platinum', 'TORQ', 'oklch(0.6 0.18 25)', 'https://torq.example', 10),
  ('Giant Bicycles', 'Platinum', 'GIANT', 'oklch(0.55 0.2 20)', null, 20),
  ('Oakley SA', 'Gold', 'OAKLEY', 'oklch(0.3 0.02 260)', 'https://oakley.example', 30),
  ('Cape Cycle Systems', 'Gold', 'CCS', 'oklch(0.5 0.12 240)', null, 40),
  ('Shimano', 'Gold', 'SHIMANO', 'oklch(0.45 0.15 240)', null, 50),
  ('Garmin', 'Silver', 'GARMIN', 'oklch(0.35 0.05 240)', null, 60),
  ('Castelli', 'Silver', 'CASTELLI', 'oklch(0.5 0.2 25)', null, 70),
  ('Maxxis', 'Bronze', 'MAXXIS', 'oklch(0.4 0.15 30)', null, 80);
