-- Drop the incomplete policies and recreate all policies correctly
DROP POLICY IF EXISTS "Public can view campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own campaign media" ON storage.objects;

-- Policy for authenticated users to upload files
CREATE POLICY "Users can upload campaign media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campaign-media');

-- Policy for public read access
CREATE POLICY "Public can view campaign media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'campaign-media');

-- Policy for authenticated users to update their files
CREATE POLICY "Users can update campaign media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'campaign-media');

-- Policy for authenticated users to delete their files
CREATE POLICY "Users can delete campaign media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'campaign-media');