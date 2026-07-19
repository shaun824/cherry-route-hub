
CREATE POLICY "event-images read all" ON storage.objects FOR SELECT USING (bucket_id = 'event-images');
CREATE POLICY "event-images admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "event-images admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "event-images admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'));
