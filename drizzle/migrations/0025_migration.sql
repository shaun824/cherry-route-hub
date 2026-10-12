DROP POLICY IF EXISTS "Sponsor logos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "event-images read all" ON storage.objects;
DROP POLICY IF EXISTS "public read event-kmls" ON storage.objects;
CREATE POLICY "Admins read event media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('sponsor-logos','event-images','event-kmls') AND private.has_role(auth.uid(), 'admin'::app_role));