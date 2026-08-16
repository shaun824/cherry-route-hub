CREATE TABLE public.loyalty_participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrant_id uuid NOT NULL REFERENCES public.entrants(id) ON DELETE CASCADE,
  en_event_id integer NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_date date,
  category text,
  source text NOT NULL DEFAULT 'entry_ninja',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entrant_id, en_event_id)
);
CREATE INDEX loyalty_participation_entrant_idx ON public.loyalty_participation(entrant_id);
CREATE INDEX loyalty_participation_event_idx ON public.loyalty_participation(en_event_id);
GRANT SELECT ON public.loyalty_participation TO authenticated;
GRANT ALL ON public.loyalty_participation TO service_role;
ALTER TABLE public.loyalty_participation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own participation" ON public.loyalty_participation FOR SELECT TO authenticated
  USING (entrant_id IN (SELECT id FROM public.entrants WHERE user_id = auth.uid()));
CREATE POLICY "admins manage participation" ON public.loyalty_participation FOR ALL TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE public.loyalty_event_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  en_event_id integer NOT NULL UNIQUE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_date date,
  points integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_event_values TO authenticated;
GRANT ALL ON public.loyalty_event_values TO service_role;
ALTER TABLE public.loyalty_event_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read event values" ON public.loyalty_event_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage event values" ON public.loyalty_event_values FOR ALL TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE TRIGGER loyalty_event_values_touch BEFORE UPDATE ON public.loyalty_event_values
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrant_id uuid NOT NULL REFERENCES public.entrants(id) ON DELETE CASCADE,
  points integer NOT NULL,
  kind text NOT NULL DEFAULT 'earn',
  en_event_id integer,
  reward_id uuid,
  reason text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_ledger_entrant_idx ON public.loyalty_ledger(entrant_id);
CREATE UNIQUE INDEX loyalty_ledger_earn_unique ON public.loyalty_ledger(entrant_id, en_event_id) WHERE kind = 'earn';
GRANT SELECT ON public.loyalty_ledger TO authenticated;
GRANT ALL ON public.loyalty_ledger TO service_role;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger" ON public.loyalty_ledger FOR SELECT TO authenticated
  USING (entrant_id IN (SELECT id FROM public.entrants WHERE user_id = auth.uid()));
CREATE POLICY "admins manage ledger" ON public.loyalty_ledger FOR ALL TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  cost_points integer NOT NULL DEFAULT 500,
  value_label text NOT NULL DEFAULT '',
  partner text,
  terms text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  valid_days integer NOT NULL DEFAULT 180,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_rewards TO authenticated;
GRANT SELECT ON public.loyalty_rewards TO anon;
GRANT ALL ON public.loyalty_rewards TO service_role;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rewards" ON public.loyalty_rewards FOR SELECT USING (true);
CREATE POLICY "admins manage rewards" ON public.loyalty_rewards FOR ALL TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE TRIGGER loyalty_rewards_touch BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.loyalty_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  entrant_id uuid NOT NULL REFERENCES public.entrants(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  reward_name text NOT NULL,
  points_spent integer NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_coupons_entrant_idx ON public.loyalty_coupons(entrant_id);
GRANT SELECT ON public.loyalty_coupons TO authenticated;
GRANT ALL ON public.loyalty_coupons TO service_role;
ALTER TABLE public.loyalty_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coupons" ON public.loyalty_coupons FOR SELECT TO authenticated
  USING (entrant_id IN (SELECT id FROM public.entrants WHERE user_id = auth.uid()));
CREATE POLICY "admins manage coupons" ON public.loyalty_coupons FOR ALL TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());

INSERT INTO public.loyalty_rewards (name, description, cost_points, value_label, partner, terms, sort_order) VALUES
  ('R150 off your next entry', 'Coupon code applied at Entry Ninja checkout on any Red Cherry event.', 750, 'R150', 'Red Cherry Events', 'One coupon per entry. Not valid with other discounts.', 1),
  ('R400 off your next entry', 'A bigger entry discount for loyal riders.', 1800, 'R400', 'Red Cherry Events', 'One coupon per entry. Not valid with other discounts.', 2),
  ('Free event jacket upgrade', 'Upgrade your event tee to the premium jacket at registration.', 1200, 'Jacket', 'Red Cherry Events', 'Subject to size availability at registration.', 3),
  ('Free tent upgrade night', 'One night upgraded tent at a Red Cherry village.', 2500, 'Upgrade', 'Red Cherry Events', 'Subject to availability, request 14 days before the event.', 4);