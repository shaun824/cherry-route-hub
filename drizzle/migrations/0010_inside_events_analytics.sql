CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_props_event_idx ON public.analytics_events ((props->>'event_id'), created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx ON public.analytics_events (user_id, created_at DESC);

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
           props->>'event_id' AS eid, props->>'tab' AS tab,
           COALESCE(user_id::text, session_id) AS actor
    FROM analytics_events
    WHERE created_at >= _since
      AND event_name IN ('tab_view','tab_exit','section_view','section_exit','action','pageview')
      AND (_event_id IS NULL OR props->>'event_id' = _event_id OR (event_name = 'pageview' AND path = '/profile'))
  ),
  events_list AS (
    SELECT eid AS event_id, max(props->>'event_name') AS event_name, count(*) AS views
    FROM analytics_events
    WHERE created_at >= _since AND event_name = 'tab_view' AND props->>'event_id' IS NOT NULL
    GROUP BY eid ORDER BY views DESC LIMIT 50
  ),
  tabs AS (
    SELECT v.tab, count(*) AS views, count(DISTINCT v.actor) AS riders,
           COALESCE((SELECT avg(x.duration_ms) FROM ev x WHERE x.event_name='tab_exit' AND x.tab=v.tab AND x.duration_ms < 3600000), 0)::bigint AS avg_ms
    FROM ev v WHERE v.event_name='tab_view' AND v.tab IS NOT NULL GROUP BY v.tab ORDER BY views DESC
  ),
  sections AS (
    SELECT props->>'section' AS section, COALESCE(tab,'info') AS tab, count(*) AS views, count(DISTINCT actor) AS riders,
           COALESCE((SELECT avg(x.duration_ms) FROM ev x WHERE x.event_name='section_exit' AND x.props->>'section'=s.props->>'section' AND x.duration_ms < 3600000),0)::bigint AS avg_ms
    FROM ev s WHERE event_name='section_view' GROUP BY props->>'section', COALESCE(tab,'info') ORDER BY views DESC LIMIT 40
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
  flagged AS (
    SELECT o.actor, bool_or(o.user_id IS NOT NULL) AS signed_in, o.k, max(o.label) AS label, max(o.tab) AS tab,
           max((SELECT count(*) FROM opens o2 WHERE o2.actor=o.actor AND o2.k=o.k AND o2.created_at BETWEEN o.created_at AND o.created_at + interval '10 minutes')) AS opens,
           max(o.created_at) AS last_at
    FROM opens o
    WHERE (SELECT count(*) FROM opens o2 WHERE o2.actor=o.actor AND o2.k=o.k AND o2.created_at BETWEEN o.created_at AND o.created_at + interval '10 minutes') >= 3
      AND NOT EXISTS (SELECT 1 FROM ev a WHERE a.actor=o.actor AND a.event_name='action'
                      AND a.props->>'action' NOT IN ('locked_section_seen')
                      AND a.created_at BETWEEN o.created_at AND o.created_at + interval '10 minutes')
    GROUP BY o.actor, o.k
    ORDER BY last_at DESC LIMIT 40
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

REVOKE ALL ON FUNCTION public.inside_events_summary(timestamp with time zone, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inside_events_summary(timestamp with time zone, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inside_events_summary(timestamp with time zone, text) TO service_role;