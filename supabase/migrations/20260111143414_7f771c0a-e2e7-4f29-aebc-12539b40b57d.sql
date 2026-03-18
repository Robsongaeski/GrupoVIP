
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('active', 'inactive', 'cancelled', 'trial');

-- Create enum for instance status
CREATE TYPE public.instance_status AS ENUM ('connected', 'disconnected', 'connecting', 'qr_pending');

-- Create enum for campaign status
CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'running', 'completed', 'cancelled');

-- Create enum for link status
CREATE TYPE public.link_status AS ENUM ('active', 'inactive', 'expired');

-- =====================
-- USER ROLES TABLE
-- =====================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- =====================
-- PROFILES TABLE
-- =====================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================
-- PLANS TABLE
-- =====================
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    max_instances INTEGER NOT NULL DEFAULT 1,
    max_groups INTEGER NOT NULL DEFAULT 10,
    max_members_per_group INTEGER NOT NULL DEFAULT 100,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- =====================
-- SUBSCRIPTIONS TABLE
-- =====================
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES public.plans(id) NOT NULL,
    status subscription_status NOT NULL DEFAULT 'trial',
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- =====================
-- WHATSAPP INSTANCES TABLE
-- =====================
CREATE TABLE public.whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    instance_name TEXT NOT NULL UNIQUE,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    status instance_status NOT NULL DEFAULT 'disconnected',
    phone_number TEXT,
    qr_code TEXT,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- =====================
-- GROUPS TABLE
-- =====================
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE NOT NULL,
    whatsapp_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    invite_link TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    max_members INTEGER NOT NULL DEFAULT 256,
    is_active BOOLEAN NOT NULL DEFAULT true,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(instance_id, whatsapp_id)
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- =====================
-- GROUP MEMBERS TABLE
-- =====================
CREATE TABLE public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    phone TEXT NOT NULL,
    name TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(group_id, phone)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- =====================
-- INTELLIGENT LINKS TABLE
-- =====================
CREATE TABLE public.intelligent_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status link_status NOT NULL DEFAULT 'active',
    redirect_url TEXT,
    click_count INTEGER NOT NULL DEFAULT 0,
    settings JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.intelligent_links ENABLE ROW LEVEL SECURITY;

-- =====================
-- LINK GROUPS (Many-to-Many)
-- =====================
CREATE TABLE public.link_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES public.intelligent_links(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(link_id, group_id)
);

ALTER TABLE public.link_groups ENABLE ROW LEVEL SECURITY;

-- =====================
-- LINK CLICKS (Analytics)
-- =====================
CREATE TABLE public.link_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES public.intelligent_links(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    referer TEXT,
    country TEXT,
    city TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

-- =====================
-- CAMPAIGNS TABLE
-- =====================
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    message_content TEXT NOT NULL,
    media_url TEXT,
    status campaign_status NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- =====================
-- CAMPAIGN GROUPS (Many-to-Many)
-- =====================
CREATE TABLE public.campaign_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(campaign_id, group_id)
);

ALTER TABLE public.campaign_groups ENABLE ROW LEVEL SECURITY;

-- =====================
-- ACTIVITY LOGS
-- =====================
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES
-- =====================

-- User Roles Policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Plans Policies (public read, admin write)
CREATE POLICY "Anyone can view active plans" ON public.plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON public.plans
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Subscriptions Policies
CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- WhatsApp Instances Policies
CREATE POLICY "Users can manage their own instances" ON public.whatsapp_instances
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all instances" ON public.whatsapp_instances
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Groups Policies
CREATE POLICY "Users can manage their own groups" ON public.groups
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all groups" ON public.groups
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Group Members Policies
CREATE POLICY "Users can manage members of their groups" ON public.group_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.groups 
            WHERE groups.id = group_members.group_id 
            AND groups.user_id = auth.uid()
        )
    );

-- Intelligent Links Policies
CREATE POLICY "Users can manage their own links" ON public.intelligent_links
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all links" ON public.intelligent_links
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Link Groups Policies
CREATE POLICY "Users can manage link groups for their links" ON public.link_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.intelligent_links 
            WHERE intelligent_links.id = link_groups.link_id 
            AND intelligent_links.user_id = auth.uid()
        )
    );

-- Link Clicks Policies (insert public for tracking, select for owners)
CREATE POLICY "Anyone can insert link clicks" ON public.link_clicks
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view clicks for their links" ON public.link_clicks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.intelligent_links 
            WHERE intelligent_links.id = link_clicks.link_id 
            AND intelligent_links.user_id = auth.uid()
        )
    );

-- Campaigns Policies
CREATE POLICY "Users can manage their own campaigns" ON public.campaigns
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all campaigns" ON public.campaigns
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Campaign Groups Policies
CREATE POLICY "Users can manage campaign groups for their campaigns" ON public.campaign_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = campaign_groups.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

-- Activity Logs Policies
CREATE POLICY "Users can view their own activity" ON public.activity_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.activity_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true);

-- =====================
-- TRIGGERS
-- =====================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_members_updated_at BEFORE UPDATE ON public.group_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_intelligent_links_updated_at BEFORE UPDATE ON public.intelligent_links
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Handle new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
    
    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- INDEXES
-- =====================
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_whatsapp_instances_user_id ON public.whatsapp_instances(user_id);
CREATE INDEX idx_groups_user_id ON public.groups(user_id);
CREATE INDEX idx_groups_instance_id ON public.groups(instance_id);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_intelligent_links_user_id ON public.intelligent_links(user_id);
CREATE INDEX idx_intelligent_links_slug ON public.intelligent_links(slug);
CREATE INDEX idx_link_clicks_link_id ON public.link_clicks(link_id);
CREATE INDEX idx_link_clicks_created_at ON public.link_clicks(created_at);
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);

-- =====================
-- INSERT DEFAULT PLANS
-- =====================
INSERT INTO public.plans (name, description, price, max_instances, max_groups, max_members_per_group, features) VALUES
('Gratuito', 'Plano gratuito para começar', 0, 1, 3, 100, '["3 grupos", "1 instância", "Links básicos"]'),
('Starter', 'Ideal para pequenos negócios', 49.90, 2, 10, 256, '["10 grupos", "2 instâncias", "Links inteligentes", "Campanhas básicas"]'),
('Professional', 'Para profissionais de marketing', 99.90, 5, 50, 512, '["50 grupos", "5 instâncias", "Links inteligentes ilimitados", "Campanhas avançadas", "Relatórios detalhados"]'),
('Enterprise', 'Solução completa para empresas', 249.90, 20, 200, 1024, '["200 grupos", "20 instâncias", "Tudo do Professional", "API dedicada", "Suporte prioritário"]');
