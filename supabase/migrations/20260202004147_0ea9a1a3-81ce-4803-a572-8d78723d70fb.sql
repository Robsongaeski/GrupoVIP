-- Reset click metrics for the 'update' link to test the fix
UPDATE public.intelligent_links 
SET click_count = 0 
WHERE slug = 'update';

DELETE FROM public.link_clicks 
WHERE link_id = (SELECT id FROM public.intelligent_links WHERE slug = 'update');