-- Allow public read access to active intelligent_links for the redirect feature
CREATE POLICY "Public can view active links" 
ON public.intelligent_links 
FOR SELECT 
USING (status = 'active');