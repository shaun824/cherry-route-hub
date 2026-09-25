CREATE OR REPLACE FUNCTION public.promo_engagement_summary(_since timestamp with time zone)
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

  WITH promo_events AS (
    SELECT
      ae.event_name,
      ae.session_id,
      ae.created_at,
      ae.props->>'promo_id' AS promo_id
    FROM public.analytics_events ae
    WHERE ae.created_at >= _since
      AND ae.event_name IN ('promo_impression', 'promo_open', 'promo_copy', 'promo_outbound')
      AND ae.props ? 'promo_id'
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = ae.user_id AND ur.role = 'admin'
      )
  ),
  per_promo AS (
    SELECT
      p.id,
      p.brand,
      p.title,
      p.code,
      p.estimated_click_value_cents,
      count(*) FILTER (WHERE pe.event_name = 'promo_impression')::integer AS impressions,
      count(DISTINCT pe.session_id) FILTER (WHERE pe.event_name = 'promo_impression')::integer AS unique_viewers,
      count(*) FILTER (WHERE pe.event_name = 'promo_open')::integer AS opens,
      count(*) FILTER (WHERE pe.event_name = 'promo_copy')::integer AS copies,
      count(*) FILTER (WHERE pe.event_name = 'promo_outbound')::integer AS outbound_clicks
    FROM public.promos p
    LEFT JOIN promo_events pe ON pe.promo_id = p.id::text
    GROUP BY p.id, p.brand, p.title, p.code, p.estimated_click_value_cents
  )
  SELECT jsonb_build_object(
    'impressions', coalesce(sum(impressions), 0),
    'unique_viewers', coalesce(sum(unique_viewers), 0),
    'opens', coalesce(sum(opens), 0),
    'copies', coalesce(sum(copies), 0),
    'outbound_clicks', coalesce(sum(outbound_clicks), 0),
    'estimated_return_cents', coalesce(sum(outbound_clicks * estimated_click_value_cents), 0),
    'promos', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'brand', brand,
      'title', title,
      'code', code,
      'estimated_click_value_cents', estimated_click_value_cents,
      'impressions', impressions,
      'unique_viewers', unique_viewers,
      'opens', opens,
      'copies', copies,
      'outbound_clicks', outbound_clicks,
      'click_through_pct', CASE WHEN impressions = 0 THEN 0 ELSE round(100.0 * outbound_clicks / impressions, 1) END,
      'estimated_return_cents', outbound_clicks * estimated_click_value_cents
    ) ORDER BY outbound_clicks DESC, brand), '[]'::jsonb)
  ) INTO result
  FROM per_promo;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.promo_engagement_summary(timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promo_engagement_summary(timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promo_engagement_summary(timestamp with time zone) TO service_role;