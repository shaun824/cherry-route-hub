ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS run_sheet_url text,
  ADD COLUMN IF NOT EXISTS run_sheet_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS run_sheet_error text,
  ADD COLUMN IF NOT EXISTS run_sheet_rows integer;

-- Departments -------------------------------------------------------------
CREATE TABLE public.event_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  lead_name text,
  contact text,
  overview text,
  safety_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_departments TO authenticated;
GRANT ALL ON public.event_departments TO service_role;
ALTER TABLE public.event_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew and admins read departments" ON public.event_departments FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage departments" ON public.event_departments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER event_departments_touch BEFORE UPDATE ON public.event_departments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Run sheet tasks ----------------------------------------------------------
CREATE TABLE public.run_sheet_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.event_departments(id) ON DELETE CASCADE,
  day_label text NOT NULL DEFAULT '',
  day_index integer NOT NULL DEFAULT 0,
  start_time text,
  end_time text,
  task text NOT NULL,
  detail text,
  owner text,
  location text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX run_sheet_tasks_event_idx ON public.run_sheet_tasks (event_id, department_id, day_index, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_sheet_tasks TO authenticated;
GRANT ALL ON public.run_sheet_tasks TO service_role;
ALTER TABLE public.run_sheet_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew and admins read tasks" ON public.run_sheet_tasks FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage tasks" ON public.run_sheet_tasks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER run_sheet_tasks_touch BEFORE UPDATE ON public.run_sheet_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Packing items ------------------------------------------------------------
CREATE TABLE public.department_packing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.event_departments(id) ON DELETE CASCADE,
  item text NOT NULL,
  qty text,
  notes text,
  critical boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'sheet',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_packing_items TO authenticated;
GRANT ALL ON public.department_packing_items TO service_role;
ALTER TABLE public.department_packing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew and admins read packing" ON public.department_packing_items FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage packing" ON public.department_packing_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER department_packing_items_touch BEFORE UPDATE ON public.department_packing_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Crew assignments ---------------------------------------------------------
CREATE TABLE public.crew_department_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.event_departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_department_assignments TO authenticated;
GRANT ALL ON public.crew_department_assignments TO service_role;
ALTER TABLE public.crew_department_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew read own assignments" ON public.crew_department_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage assignments" ON public.crew_department_assignments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Per-crew task tick-off ---------------------------------------------------
CREATE TABLE public.crew_task_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.run_sheet_tasks(id) ON DELETE CASCADE,
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_task_state TO authenticated;
GRANT ALL ON public.crew_task_state TO service_role;
ALTER TABLE public.crew_task_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew manage own task state" ON public.crew_task_state FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid());

-- Packing suggestions ------------------------------------------------------
CREATE TABLE public.packing_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.event_departments(id) ON DELETE CASCADE,
  item text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_suggestions TO authenticated;
GRANT ALL ON public.packing_suggestions TO service_role;
ALTER TABLE public.packing_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew read suggestions" ON public.packing_suggestions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Crew add own suggestions" ON public.packing_suggestions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
    AND (private.has_role(auth.uid(), 'crew'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins review suggestions" ON public.packing_suggestions FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete suggestions" ON public.packing_suggestions FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- Waivers ------------------------------------------------------------------
CREATE TABLE public.crew_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.event_departments(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  waiver_version text NOT NULL DEFAULT 'v1',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  UNIQUE (user_id, event_id, waiver_version)
);
GRANT SELECT, INSERT ON public.crew_waivers TO authenticated;
GRANT ALL ON public.crew_waivers TO service_role;
ALTER TABLE public.crew_waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew read own waivers" ON public.crew_waivers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Crew accept own waiver" ON public.crew_waivers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());