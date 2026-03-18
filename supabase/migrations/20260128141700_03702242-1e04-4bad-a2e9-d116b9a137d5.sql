-- Add facebook_pixel_name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS facebook_pixel_name TEXT;