-- Public read of KML files (needed for map rendering without signed URLs)
CREATE POLICY "public read event-kmls"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-kmls');

CREATE POLICY "admins upload event-kmls"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-kmls' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update event-kmls"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-kmls' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete event-kmls"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-kmls' AND public.has_role(auth.uid(), 'admin'));