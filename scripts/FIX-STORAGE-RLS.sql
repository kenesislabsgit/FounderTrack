-- Fix storage RLS for check-in photos

-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload their own check-in photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'check-in-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own photos
CREATE POLICY "Users can view their own check-in photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'check-in-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to view all photos
CREATE POLICY "Admins can view all check-in photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'check-in-photos' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE uid::text = auth.uid()::text
    AND role IN ('admin', 'founder')
  )
);
