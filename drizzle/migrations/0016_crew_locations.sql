CREATE TABLE public.crew_locations (
  device_id text NOT NULL,
  event_id uuid NOT NULL,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, device_id)
);
GRANT ALL ON public.crew_locations TO service_role;
ALTER TABLE public.crew_locations ENABLE ROW LEVEL SECURITY;
-- No client policies: read/write only through verified server functions.