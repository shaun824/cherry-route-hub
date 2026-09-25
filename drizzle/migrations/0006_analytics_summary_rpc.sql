CREATE OR REPLACE FUNCTION public.analytics_summary(_since timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  WITH base AS (
    SELECT * FROM public.analytics_events WHERE created_at >= _since
  ),
  staff_sessions AS (
    SELECT DISTINCT b.session_id FROM base b
    JOIN public.user_roles ur ON ur.user_id = b.user_id AND ur.role = 'admin'
  ),
  rows AS (
    SELECT b.* FROM base b WHERE b.session_id NOT IN (SELECT session_id FROM staff_sessions)
  ),
  views AS (SELECT * FROM rows WHERE event_name = 'pageview'),
  exits AS (SELECT * FROM rows WHERE event_name = 'page_exit' AND coalesce(duration_ms,0) > 0),
  sess AS (
    SELECT session_id, count(DISTINCT coalesce(route_label, path)) AS screens FROM views GROUP BY session_id
  ),
  per_page AS (
    SELECT coalesce(v.route_label, v.path) AS path, count(*) AS views, count(DISTINCT v.session_id) AS sessions,
      (SELECT coalesce(avg(e.duration_ms),0) FROM exits e WHERE coalesce(e.route_label,e.path) = coalesce(v.route_label, v.path)) AS avg
    FROM views v GROUP BY 1 ORDER BY 2 DESC LIMIT 50
  ),
  trend AS (
    SELECT to_char(d::date,'YYYY-MM-DD') AS date,
      (SELECT count(*) FROM views v WHERE (v.created_at AT TIME ZONE 'UTC')::date = d::date) AS views,
      (SELECT count(DISTINCT session_id) FROM views v WHERE (v.created_at AT TIME ZONE 'UTC')::date = d::date) AS sessions
    FROM generate_series((_since AT TIME ZONE 'UTC')::date + 1, (now() AT TIME ZONE 'UTC')::date, interval '1 day') d
  ),
  devices AS (
    SELECT coalesce(device,'unknown') AS device, count(DISTINCT session_id) AS count FROM views GROUP BY 1 ORDER BY 2 DESC
  ),
  recent AS (
    SELECT session_id, max(created_at) AS last, bool_or(user_id IS NOT NULL) AS signed_in
    FROM views GROUP BY session_id ORDER BY 2 DESC LIMIT 25
  ),
  journeys AS (
    SELECT r.session_id AS id, r.last, r.signed_in AS "user",
      (SELECT coalesce(jsonb_agg(label ORDER BY ts), '[]'::jsonb) FROM (
        SELECT label, ts FROM (
          SELECT coalesce(v.route_label, v.path) AS label, v.created_at AS ts,
                 lag(coalesce(v.route_label, v.path)) OVER (ORDER BY v.created_at) AS prev
          FROM views v WHERE v.session_id = r.session_id
        ) x WHERE prev IS DISTINCT FROM label
      ) y) AS steps
    FROM recent r
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT count(*) FROM sess),
    'signed_in', (SELECT count(DISTINCT user_id) FROM views WHERE user_id IS NOT NULL),
    'page_views', (SELECT count(*) FROM views),
    'unique_screens', (SELECT count(DISTINCT coalesce(route_label,path)) FROM views),
    'avg_time_ms', (SELECT coalesce(avg(duration_ms),0) FROM exits),
    'bounce_pct', (SELECT CASE WHEN count(*)=0 THEN 0 ELSE round(100.0*count(*) FILTER (WHERE screens=1)/count(*)) END FROM sess),
    'per_page', (SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM per_page p),
    'trend', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.date), '[]'::jsonb) FROM trend t),
    'devices', (SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) FROM devices d),
    'journeys', (SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY j.last DESC), '[]'::jsonb) FROM journeys j)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_summary(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analytics_summary(timestamptz) TO authenticated;