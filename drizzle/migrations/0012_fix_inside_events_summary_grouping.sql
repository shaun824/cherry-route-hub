CREATE OR REPLACE FUNCTION public.inside_events_summary(_since timestamp with time zone, _event_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  WITH ev AS (
    SELECT id, session_id, user_id, event_name, duration_ms, created_at, path, props,
           props->>'event_id' AS eid, props->>'tab' AS tab, props->>'section' AS section,
           COALESCE(user_id::text, session_id) AS actor
    FROM analytics_events
    WHERE created_at >= _since
      AND event_name IN ('tab_view','tab_exit','section_view','section_exit','action','pageview')
      AND (_event_id IS NULL OR props->>'event_id' = _event_id OR (event_name = 'pageview' AND path = '/profile'))
  ),
  events_list AS (
    SELECT props->>'event_id' AS event_id, max(props->>'event_name') AS event_name, count(*) AS views
    FROM analytics_events
    WHERE created_at >= _since AND event_name = 'tab_view' AND props->>'event_id' IS NOT NULL
    GROUP BY props->>'event_id' ORDER BY views DESC LIMIT 50
  ),
  tab_exits AS (
    SELECT tab, avg(duration_ms) AS avg_ms FROM ev
    WHERE event_name='tab_exit' AND duration_ms < 3600000 GROUP BY tab
  ),
  tabs AS (
    SELECT v.tab, count(*) AS views, count(DISTINCT v.actor) AS riders, COALESCE(max(te.avg_ms), 0)::bigint AS avg_ms
    FROM ev v LEFT JOIN tab_exits te ON te.tab = v.tab
    WHERE v.event_name='tab_view' AND v.tab IS NOT NULL GROUP BY v.tab ORDER BY views DESC
  ),
  section_exits AS (
    SELECT section, avg(duration_ms) AS avg_ms FROM ev
    WHERE event_name='section_exit' AND duration_ms < 3600000 GROUP BY section
  ),
  sections AS (
    SELECT s.section, COALESCE(s.tab,'info') AS tab, count(*) AS views, count(DISTINCT s.actor) AS riders,
           COALESCE(max(se.avg_ms), 0)::bigint AS avg_ms
    FROM ev s LEFT JOIN section_exits se ON se.section = s.section
    WHERE s.event_name='section_view' GROUP BY s.section, COALESCE(s.tab,'info') ORDER BY views DESC LIMIT 40
  ),
  actions AS (
    SELECT props->>'action' AS action, COALESCE(tab,'—') AS tab, count(*) AS count, count(DISTINCT actor) AS riders
    FROM ev WHERE event_name='action' AND props->>'action' NOT IN ('locked_section_seen')
    GROUP BY props->>'action', COALESCE(tab,'—') ORDER BY count DESC LIMIT 40
  ),
  walls AS (
    SELECT props->>'wall' AS wall, COALESCE(tab,'—') AS tab,
           count(*) FILTER (WHERE props->>'action'='locked_section_seen') AS seen,
           count(*) FILTER (WHERE props->>'action'='sign_in_prompt_clicked') AS clicked,
           count(DISTINCT actor) AS visitors
    FROM ev WHERE event_name='action' AND props->>'action' IN ('locked_section_seen','sign_in_prompt_clicked')
    GROUP BY props->>'wall', COALESCE(tab,'—') ORDER BY seen DESC LIMIT 30
  ),
  opens AS (
    SELECT actor, user_id, created_at,
           CASE WHEN event_name='pageview' THEN 'profile' ELSE eid || '|' || tab END AS k,
           CASE WHEN event_name='pageview' THEN 'Profile' ELSE COALESCE(props->>'event_name','Event') END AS label,
           CASE WHEN event_name='pageview' THEN 'profile' ELSE tab END AS tab
    FROM ev WHERE (event_name='tab_view' AND eid IS NOT NULL) OR (event_name='pageview' AND path='/profile')
  ),
  opens_windowed AS (
    SELECT o.*,
           (SELECT count(*) FROM opens o2 WHERE o2.actor=o.actor AND o2.k=o.k
              AND o2.created_at BETWEEN o.created_at AND o.created_at + interval '10 minutes') AS n
    FROM opens o
    WHERE NOT EXISTS (SELECT 1 FROM ev a WHERE a.actor=o.actor AND a.event_name='action'
                      AND a.props->>'action' NOT IN ('locked_section_seen')
                      AND a.created_at BETWEEN o.created_at AND o.created_at + interval '10 minutes')
  ),
  flagged AS (
    SELECT actor, k, bool_or(user_id IS NOT NULL) AS signed_in, max(label) AS label, max(tab) AS tab,
           max(n) AS opens, max(created_at) AS last_at
    FROM opens_windowed WHERE n >= 3
    GROUP BY actor, k ORDER BY last_at DESC LIMIT 40
  )
  SELECT jsonb_build_object(
    'events', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM events_list e), '[]'::jsonb),
    'tabs', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM tabs t), '[]'::jsonb),
    'sections', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM sections s), '[]'::jsonb),
    'actions', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM actions a), '[]'::jsonb),
    'walls', COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM walls w), '[]'::jsonb),
    'confusion', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', f.label, 'tab', f.tab, 'opens', f.opens, 'signed_in', f.signed_in, 'last_at', f.last_at)) FROM flagged f), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;