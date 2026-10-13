CREATE TABLE public.strava_connections (
  user_id uuid PRIMARY KEY,
  athlete_id bigint NOT NULL,
  athlete_name text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.strava_connections TO service_role;
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.strava_segment_efforts (
  id bigint PRIMARY KEY,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event_entrant_id uuid,
  category text,
  activity_id bigint NOT NULL,
  segment_id bigint NOT NULL,
  segment_name text NOT NULL,
  distance_m numeric,
  average_grade numeric,
  elapsed_s integer NOT NULL,
  start_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX strava_efforts_event_idx ON public.strava_segment_efforts (event_id, segment_id);
GRANT ALL ON public.strava_segment_efforts TO service_role;
ALTER TABLE public.strava_segment_efforts ENABLE ROW LEVEL SECURITY;