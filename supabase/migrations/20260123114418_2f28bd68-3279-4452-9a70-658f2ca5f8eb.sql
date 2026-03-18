-- Add instance_token column to store UAZAPI-specific token per instance
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS instance_token TEXT;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.whatsapp_instances.instance_token IS 'Token específico da instância UAZAPI, retornado ao criar a instância via /instance/init';