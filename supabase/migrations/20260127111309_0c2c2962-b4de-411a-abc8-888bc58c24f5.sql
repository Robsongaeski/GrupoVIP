-- ============================================
-- TABELA DE AUDITORIA DE ENVIO DE MENSAGENS
-- Registra TODAS as tentativas de envio
-- ============================================

CREATE TABLE public.message_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Identificação da fonte
  source text NOT NULL, -- 'send-campaign', 'process-scheduled', 'retry-campaign-failed', 'auto-retry', 'manual', 'unknown'
  function_name text, -- nome da edge function que fez a chamada
  
  -- Referências (opcionais)
  campaign_id uuid,
  group_id uuid,
  item_id uuid,
  instance_id uuid,
  user_id uuid,
  
  -- Detalhes da mensagem
  instance_name text,
  group_whatsapp_id text,
  message_type text, -- 'text', 'media', 'poll'
  message_preview text, -- primeiros 200 chars do conteúdo
  
  -- Rastreamento da chamada API
  api_endpoint text,
  request_payload jsonb,
  response_payload jsonb,
  response_status integer,
  
  -- Status e bloqueios
  was_blocked boolean DEFAULT false,
  block_reason text,
  
  -- Informações do caller
  caller_info jsonb -- headers, IP se disponível
);

-- Índices para consultas rápidas
CREATE INDEX idx_message_audit_log_created_at ON public.message_audit_log(created_at DESC);
CREATE INDEX idx_message_audit_log_source ON public.message_audit_log(source);
CREATE INDEX idx_message_audit_log_campaign_id ON public.message_audit_log(campaign_id);
CREATE INDEX idx_message_audit_log_user_id ON public.message_audit_log(user_id);
CREATE INDEX idx_message_audit_log_blocked ON public.message_audit_log(was_blocked) WHERE was_blocked = true;
CREATE INDEX idx_message_audit_log_instance_name ON public.message_audit_log(instance_name);

-- Enable RLS
ALTER TABLE public.message_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can view all audit logs" 
ON public.message_audit_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view audit logs for their campaigns" 
ON public.message_audit_log 
FOR SELECT 
USING (user_id = auth.uid());

-- Service role pode inserir (as edge functions usam service role)
CREATE POLICY "Service role can insert audit logs" 
ON public.message_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Comentário explicativo
COMMENT ON TABLE public.message_audit_log IS 'Registra todas as tentativas de envio de mensagem para rastreabilidade e debugging';

-- ============================================
-- TABELA DE LOCK POR INSTÂNCIA
-- Evita envios simultâneos na mesma instância
-- ============================================

CREATE TABLE public.instance_send_lock (
  instance_id uuid NOT NULL PRIMARY KEY REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  locked_until timestamp with time zone NOT NULL,
  locked_by text NOT NULL, -- identificador do processo (ex: 'send-campaign:campaign_id')
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instance_send_lock ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Service role can manage locks" 
ON public.instance_send_lock 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Admins can view locks" 
ON public.instance_send_lock 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Função para limpar locks expirados (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.instance_send_lock
  WHERE locked_until < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Comentário explicativo
COMMENT ON TABLE public.instance_send_lock IS 'Controle de locks para evitar envios simultâneos na mesma instância WhatsApp';