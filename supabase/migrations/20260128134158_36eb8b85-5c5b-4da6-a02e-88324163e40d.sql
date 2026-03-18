-- Add Facebook Pixel tracking fields to intelligent_links
ALTER TABLE public.intelligent_links 
ADD COLUMN IF NOT EXISTS facebook_pixel_id TEXT,
ADD COLUMN IF NOT EXISTS facebook_pixel_event TEXT DEFAULT 'PageView';

-- Add comment for documentation
COMMENT ON COLUMN public.intelligent_links.facebook_pixel_id IS 'Facebook Pixel ID for tracking (e.g., 1234567890)';
COMMENT ON COLUMN public.intelligent_links.facebook_pixel_event IS 'Facebook Pixel event to fire (e.g., PageView, Lead, CompleteRegistration)';