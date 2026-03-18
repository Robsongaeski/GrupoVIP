-- Fix RLS policies for whatsapp_instances
DROP POLICY IF EXISTS "Users can view their own instances" ON public.whatsapp_instances;
CREATE POLICY "Users can view their own instances" 
ON public.whatsapp_instances 
FOR SELECT 
USING (auth.uid() = user_id);

-- Fix RLS policies for groups
DROP POLICY IF EXISTS "Users can view their own groups" ON public.groups;
CREATE POLICY "Users can view their own groups" 
ON public.groups 
FOR SELECT 
USING (auth.uid() = user_id);

-- Fix RLS policies for campaigns
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
CREATE POLICY "Users can view their own campaigns" 
ON public.campaigns 
FOR SELECT 
USING (auth.uid() = user_id);

-- Fix RLS policies for subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions" 
ON public.subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Fix RLS policies for profiles (users can only see their own profile)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Fix RLS policies for activity_logs (users can only see their own logs)
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs" 
ON public.activity_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow admins to view all data for admin panels
DROP POLICY IF EXISTS "Admins can view all instances" ON public.whatsapp_instances;
CREATE POLICY "Admins can view all instances" 
ON public.whatsapp_instances 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all groups" ON public.groups;
CREATE POLICY "Admins can view all groups" 
ON public.groups 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
CREATE POLICY "Admins can view all campaigns" 
ON public.campaigns 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions" 
ON public.subscriptions 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view all activity logs" 
ON public.activity_logs 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));