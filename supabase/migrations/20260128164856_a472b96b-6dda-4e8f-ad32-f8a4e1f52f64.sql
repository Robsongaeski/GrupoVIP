-- Permitir usuários autenticados lerem APENAS a chave pública do Mercado Pago
CREATE POLICY "Users can read public payment config"
ON public.system_config
FOR SELECT
TO authenticated
USING (key = 'mercadopago_public_key');