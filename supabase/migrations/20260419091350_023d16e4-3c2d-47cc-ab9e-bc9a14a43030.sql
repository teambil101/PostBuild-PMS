-- Tighten storage select policies on public buckets to prevent listing.
-- Files remain accessible via their public CDN URL regardless.
DROP POLICY IF EXISTS "Public can view property photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

CREATE POLICY "Auth can list property photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'property-photos' AND public.has_any_role(auth.uid()));
CREATE POLICY "Auth can list avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND public.has_any_role(auth.uid()));