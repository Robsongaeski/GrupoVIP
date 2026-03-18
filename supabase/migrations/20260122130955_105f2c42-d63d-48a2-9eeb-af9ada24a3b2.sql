-- Add UAZAPI configuration entries to system_config
INSERT INTO public.system_config (key, value, description, is_secret)
VALUES 
  ('whatsapp_provider', 'evolution', 'Provider de WhatsApp ativo (evolution ou uazapi)', false),
  ('uazapi_subdomain', '', 'Subdomínio da UAZAPI (ex: meuapp)', false),
  ('uazapi_admin_token', '', 'Token administrativo da UAZAPI', true)
ON CONFLICT (key) DO NOTHING;