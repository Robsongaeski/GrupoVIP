-- Add show_landing_page field to intelligent_links table
ALTER TABLE public.intelligent_links 
ADD COLUMN show_landing_page boolean NOT NULL DEFAULT true;