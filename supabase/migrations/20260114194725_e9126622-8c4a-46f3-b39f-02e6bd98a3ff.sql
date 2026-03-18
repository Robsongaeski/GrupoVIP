-- Drop all SELECT policies and recreate as PERMISSIVE (correct syntax)
-- whatsapp_instances
DROP POLICY IF EXISTS "Users can view their own instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Admins can view all instances" ON public.whatsapp_instances;
CREATE POLICY "Users can view their own instances" 
ON public.whatsapp_instances 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all instances" 
ON public.whatsapp_instances 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- groups
DROP POLICY IF EXISTS "Users can view their own groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can view all groups" ON public.groups;
CREATE POLICY "Users can view their own groups" 
ON public.groups 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all groups" 
ON public.groups 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- campaigns
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
CREATE POLICY "Users can view their own campaigns" 
ON public.campaigns 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all campaigns" 
ON public.campaigns 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions" 
ON public.subscriptions 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" 
ON public.subscriptions 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- activity_logs
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all activity" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs" 
ON public.activity_logs 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity logs" 
ON public.activity_logs 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));