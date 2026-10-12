GRANT SELECT, INSERT ON public.tracking_points TO authenticated;
GRANT ALL ON public.tracking_points TO service_role;
-- anon may query but no anon policy exists, so GPS history stays private (returns no rows, no error).
GRANT SELECT ON public.tracking_points TO anon;