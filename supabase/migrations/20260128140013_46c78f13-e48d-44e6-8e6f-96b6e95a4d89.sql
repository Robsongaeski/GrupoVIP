-- Add global Facebook Pixel ID to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS facebook_pixel_id TEXT;