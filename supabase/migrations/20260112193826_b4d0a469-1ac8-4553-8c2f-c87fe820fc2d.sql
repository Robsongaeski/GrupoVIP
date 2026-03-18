-- Drop existing FK constraint and recreate with CASCADE
ALTER TABLE public.send_logs DROP CONSTRAINT IF EXISTS send_logs_group_id_fkey;

ALTER TABLE public.send_logs 
ADD CONSTRAINT send_logs_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES public.groups(id) 
ON DELETE CASCADE;

-- Also fix link_clicks if needed
ALTER TABLE public.link_clicks DROP CONSTRAINT IF EXISTS link_clicks_group_id_fkey;

ALTER TABLE public.link_clicks 
ADD CONSTRAINT link_clicks_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES public.groups(id) 
ON DELETE CASCADE;

-- Also fix intelligent_links reserve_group_id
ALTER TABLE public.intelligent_links DROP CONSTRAINT IF EXISTS intelligent_links_reserve_group_id_fkey;

ALTER TABLE public.intelligent_links 
ADD CONSTRAINT intelligent_links_reserve_group_id_fkey 
FOREIGN KEY (reserve_group_id) 
REFERENCES public.groups(id) 
ON DELETE SET NULL;