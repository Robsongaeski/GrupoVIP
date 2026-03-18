
-- =====================================================
-- FASE 1: MIGRAÇÃO COMPLETA DO BANCO DE DADOS
-- Sistema SaaS de Gerenciamento de Grupos WhatsApp
-- =====================================================

-- =====================
-- ENUMS ADICIONAIS
-- =====================
CREATE TYPE public.subscription_status_full AS ENUM ('trial', 'active', 'payment_pending', 'suspended', 'cancelled');
CREATE TYPE public.campaign_item_type AS ENUM ('text', 'media', 'poll');
CREATE TYPE public.media_type AS ENUM ('image', 'video', 'document', 'audio');
CREATE TYPE public.group_action_type AS ENUM ('name', 'description', 'photo');
CREATE TYPE public.action_status AS ENUM ('pending', 'executing', 'completed', 'failed', 'cancelled');
CREATE TYPE public.link_mode AS ENUM ('connected', 'manual');
CREATE TYPE public.send_log_status AS ENUM ('pending', 'sent', 'failed');

-- =====================
-- CONFIGURAÇÃO DO SISTEMA (Admin SaaS)
-- =====================
CREATE TABLE public.system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    is_secret BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver/editar configurações
CREATE POLICY "Admins can manage system config" ON public.system_config
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Inserir configurações padrão da Evolution API
INSERT INTO public.system_config (key, value, description, is_secret) VALUES
('evolution_api_url', '', 'URL base da Evolution API', false),
('evolution_api_key', '', 'Token/API Key da Evolution API', true),
('evolution_rate_limit_delay', '2000', 'Delay em ms entre chamadas à API', false),
('evolution_group_delay', '3000', 'Delay em ms entre envios para grupos', false),
('default_timezone', 'America/Sao_Paulo', 'Fuso horário padrão', false),
('log_retention_days', '90', 'Dias para reter logs antes de limpar', false);

-- =====================
-- ATUALIZAR PROFILES COM CAMPOS DE ASSINATURA
-- =====================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_status subscription_status_full DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo';

-- =====================
-- PLANOS DE ASSINATURA
-- =====================
DROP TABLE IF EXISTS public.plans CASCADE;
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    periodicity TEXT NOT NULL DEFAULT 'monthly', -- monthly, yearly
    max_instances INTEGER DEFAULT 1,
    max_groups INTEGER DEFAULT 10,
    max_campaigns_month INTEGER DEFAULT 50,
    max_links INTEGER DEFAULT 5,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON public.plans
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Planos padrão
INSERT INTO public.plans (name, description, price, periodicity, max_instances, max_groups, max_campaigns_month, max_links, features) VALUES
('Gratuito', 'Plano gratuito para testar', 0, 'monthly', 1, 3, 10, 2, '["3 grupos", "10 campanhas/mês", "2 links"]'),
('Starter', 'Ideal para pequenos negócios', 97, 'monthly', 2, 20, 100, 10, '["20 grupos", "100 campanhas/mês", "10 links", "Suporte por email"]'),
('Professional', 'Para profissionais', 197, 'monthly', 5, 100, 500, 50, '["100 grupos", "500 campanhas/mês", "50 links", "Suporte prioritário", "Relatórios avançados"]'),
('Enterprise', 'Solução completa', 497, 'monthly', 20, 500, 2000, 200, '["500 grupos", "2000 campanhas/mês", "200 links", "Suporte dedicado", "API acesso"]');

-- =====================
-- ASSINATURAS DOS CLIENTES
-- =====================
DROP TABLE IF EXISTS public.subscriptions CASCADE;
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES public.plans(id) NOT NULL,
    status subscription_status_full NOT NULL DEFAULT 'trial',
    periodicity TEXT NOT NULL DEFAULT 'monthly',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    payment_failed_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- HISTÓRICO DE STATUS DE ASSINATURA
-- =====================
CREATE TABLE public.subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    old_status subscription_status_full,
    new_status subscription_status_full NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history" ON public.subscription_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all history" ON public.subscription_history
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- ATUALIZAR WHATSAPP INSTANCES
-- =====================
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS phone_masked TEXT,
ADD COLUMN IF NOT EXISTS evolution_instance_id TEXT;

-- Remover requirement de api_url e api_key (virão da config global)
ALTER TABLE public.whatsapp_instances 
ALTER COLUMN api_url DROP NOT NULL,
ALTER COLUMN api_key DROP NOT NULL;

-- =====================
-- ATUALIZAR GRUPOS
-- =====================
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS participants_count INTEGER DEFAULT 0;

-- =====================
-- ITENS DA CAMPANHA (SEQUÊNCIA DE MENSAGENS)
-- =====================
CREATE TABLE public.campaign_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    item_type campaign_item_type NOT NULL DEFAULT 'text',
    -- Texto
    text_content TEXT,
    -- Mídia
    media_url TEXT,
    media_type media_type,
    media_caption TEXT,
    media_filename TEXT,
    -- Enquete
    poll_question TEXT,
    poll_options JSONB, -- ["Opção 1", "Opção 2", ...]
    poll_allow_multiple BOOLEAN DEFAULT false,
    -- Delay após este item (em segundos)
    delay_after INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage items of their campaigns" ON public.campaign_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = campaign_items.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE INDEX idx_campaign_items_campaign_id ON public.campaign_items(campaign_id);
CREATE INDEX idx_campaign_items_order ON public.campaign_items(campaign_id, order_index);

-- =====================
-- LOGS DE ENVIO DETALHADOS
-- =====================
CREATE TABLE public.send_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    campaign_item_id UUID REFERENCES public.campaign_items(id) ON DELETE SET NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL NOT NULL,
    status send_log_status NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    api_response JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of their campaigns" ON public.send_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = send_logs.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all logs" ON public.send_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_send_logs_campaign_id ON public.send_logs(campaign_id);
CREATE INDEX idx_send_logs_status ON public.send_logs(status);
CREATE INDEX idx_send_logs_created_at ON public.send_logs(created_at);

-- =====================
-- AÇÕES DE GRUPO AGENDADAS
-- =====================
CREATE TABLE public.group_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE NOT NULL,
    action_type group_action_type NOT NULL,
    new_value_text TEXT, -- Para nome e descrição
    new_value_file_url TEXT, -- Para foto
    status action_status NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own group actions" ON public.group_actions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all group actions" ON public.group_actions
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_group_actions_user_id ON public.group_actions(user_id);
CREATE INDEX idx_group_actions_status ON public.group_actions(status);
CREATE INDEX idx_group_actions_scheduled_at ON public.group_actions(scheduled_at);

-- =====================
-- GRUPOS ALVO DAS AÇÕES
-- =====================
CREATE TABLE public.group_action_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID REFERENCES public.group_actions(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    status action_status NOT NULL DEFAULT 'pending',
    executed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(action_id, group_id)
);

ALTER TABLE public.group_action_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage targets of their actions" ON public.group_action_targets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.group_actions 
            WHERE group_actions.id = group_action_targets.action_id 
            AND group_actions.user_id = auth.uid()
        )
    );

-- =====================
-- SNAPSHOTS DE GRUPO (PARA REVERTER)
-- =====================
CREATE TABLE public.group_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    action_id UUID REFERENCES public.group_actions(id) ON DELETE SET NULL,
    name_before TEXT,
    description_before TEXT,
    photo_url_before TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view snapshots of their groups" ON public.group_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.groups 
            WHERE groups.id = group_snapshots.group_id 
            AND groups.user_id = auth.uid()
        )
    );

CREATE INDEX idx_group_snapshots_group_id ON public.group_snapshots(group_id);

-- =====================
-- ATUALIZAR LINKS INTELIGENTES
-- =====================
ALTER TABLE public.intelligent_links 
ADD COLUMN IF NOT EXISTS mode link_mode NOT NULL DEFAULT 'connected',
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS landing_description TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS capacity_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS reserve_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS no_vacancy_message TEXT DEFAULT 'Sem vagas no momento. Tente novamente mais tarde.',
ADD COLUMN IF NOT EXISTS anti_abuse_cooldown INTEGER DEFAULT 60; -- segundos

-- =====================
-- GRUPOS MANUAIS PARA LINKS (MODO MANUAL)
-- =====================
CREATE TABLE public.link_manual_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES public.intelligent_links(id) ON DELETE CASCADE NOT NULL,
    internal_name TEXT NOT NULL,
    invite_url TEXT NOT NULL,
    click_limit INTEGER NOT NULL DEFAULT 1000,
    current_clicks INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.link_manual_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage manual groups of their links" ON public.link_manual_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.intelligent_links 
            WHERE intelligent_links.id = link_manual_groups.link_id 
            AND intelligent_links.user_id = auth.uid()
        )
    );

CREATE INDEX idx_link_manual_groups_link_id ON public.link_manual_groups(link_id);

-- =====================
-- ATUALIZAR CLIQUES DE LINKS (UTM TRACKING)
-- =====================
ALTER TABLE public.link_clicks 
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS manual_group_id UUID REFERENCES public.link_manual_groups(id) ON DELETE SET NULL;

-- =====================
-- AUDITORIA ADMIN
-- =====================
CREATE TABLE public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT, -- 'user', 'subscription', 'config', etc
    target_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);

-- =====================
-- ATUALIZAR CAMPANHAS COM CAMPOS ADICIONAIS
-- =====================
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS delay_between_items INTEGER DEFAULT 2, -- segundos
ADD COLUMN IF NOT EXISTS delay_between_groups INTEGER DEFAULT 3; -- segundos

-- =====================
-- TRIGGERS PARA UPDATED_AT
-- =====================
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON public.system_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_items_updated_at BEFORE UPDATE ON public.campaign_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_actions_updated_at BEFORE UPDATE ON public.group_actions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_link_manual_groups_updated_at BEFORE UPDATE ON public.link_manual_groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- FUNÇÃO PARA VERIFICAR SE CLIENTE ESTÁ SUSPENSO
-- =====================
CREATE OR REPLACE FUNCTION public.is_user_suspended(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.subscriptions
        WHERE user_id = _user_id
        AND status IN ('suspended', 'cancelled')
    )
$$;

-- =====================
-- FUNÇÃO PARA VERIFICAR SE CLIENTE PODE EXECUTAR AÇÕES
-- =====================
CREATE OR REPLACE FUNCTION public.can_user_execute_actions(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (
        SELECT 1
        FROM public.subscriptions
        WHERE user_id = _user_id
        AND status IN ('suspended', 'cancelled')
    )
$$;

-- =====================
-- ATUALIZAR TRIGGER DE NOVO USUÁRIO PARA CRIAR ASSINATURA TRIAL
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, subscription_status, timezone)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', 'trial', 'America/Sao_Paulo');
    
    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Get free plan ID
    SELECT id INTO free_plan_id FROM public.plans WHERE price = 0 AND is_active = true LIMIT 1;
    
    -- Create trial subscription
    IF free_plan_id IS NOT NULL THEN
        INSERT INTO public.subscriptions (user_id, plan_id, status, started_at, expires_at)
        VALUES (NEW.id, free_plan_id, 'trial', now(), now() + interval '14 days');
    END IF;
    
    RETURN NEW;
END;
$$;

-- =====================
-- STORAGE BUCKET PARA MÍDIA
-- =====================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'campaign-media', 
    'campaign-media', 
    true,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf', 'audio/mpeg', 'audio/ogg']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own media" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'campaign-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view their own media" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'campaign-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own media" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'campaign-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Public can view campaign media" ON storage.objects
    FOR SELECT USING (bucket_id = 'campaign-media');

-- =====================
-- STORAGE BUCKET PARA LOGOS E FOTOS
-- =====================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assets', 
    'assets', 
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'assets' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Public can view assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'assets');
