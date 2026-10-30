CREATE TABLE public.crew_emergency_profiles (
  user_id uuid PRIMARY KEY,
  first_name text NOT NULL,
  cell_number text NOT NULL,
  date_of_birth date NOT NULL,
  medical_aid_name text NOT NULL,
  medical_aid_number text,
  medical_aid_plan text,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.crew_emergency_profiles TO authenticated;
GRANT ALL ON public.crew_emergency_profiles TO service_role;
ALTER TABLE public.crew_emergency_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own crew emergency profile read" ON public.crew_emergency_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Own crew emergency profile insert" ON public.crew_emergency_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own crew emergency profile update" ON public.crew_emergency_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER crew_emergency_profiles_touch BEFORE UPDATE ON public.crew_emergency_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();