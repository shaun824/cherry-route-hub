
CREATE POLICY "Sponsor logos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'sponsor-logos');

CREATE POLICY "Admins can upload sponsor logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sponsor-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sponsor logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sponsor-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sponsor logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sponsor-logos' AND public.has_role(auth.uid(), 'admin'));
