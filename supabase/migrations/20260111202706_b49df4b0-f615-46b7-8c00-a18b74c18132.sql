-- Inserir configurações do Mercado Pago
INSERT INTO public.system_config (key, value, description, is_secret)
VALUES 
  ('mercadopago_access_token', '', 'Access Token do Mercado Pago (Produção)', true),
  ('mercadopago_public_key', '', 'Public Key do Mercado Pago', false),
  ('mercadopago_webhook_secret', '', 'Secret para validação de webhooks', true),
  ('mercadopago_sandbox', 'false', 'Modo sandbox/teste do Mercado Pago', false)
ON CONFLICT (key) DO NOTHING;