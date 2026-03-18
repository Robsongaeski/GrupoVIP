
-- Fix function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Fix overly permissive INSERT policy on link_clicks
-- Drop the old policy and create a more restrictive one
DROP POLICY IF EXISTS "Anyone can insert link clicks" ON public.link_clicks;

CREATE POLICY "Insert link clicks for valid links" ON public.link_clicks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.intelligent_links 
            WHERE intelligent_links.id = link_clicks.link_id 
            AND intelligent_links.status = 'active'
        )
    );

-- Fix overly permissive INSERT policy on activity_logs
DROP POLICY IF EXISTS "System can insert activity logs" ON public.activity_logs;

CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR auth.uid() = user_id));
