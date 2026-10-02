ALTER TABLE public.run_sheet_tasks ADD COLUMN kind text NOT NULL DEFAULT 'task';
COMMENT ON COLUMN public.run_sheet_tasks.kind IS 'task = normal row; header = section heading used to group the plan';