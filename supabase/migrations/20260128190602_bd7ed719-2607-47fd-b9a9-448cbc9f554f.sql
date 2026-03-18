-- Adicionar índice único em external_payment_id para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_external_payment_id_unique ON payments(external_payment_id);

-- Inserir o pagamento de cartão que foi processado mas não registrado
INSERT INTO payments (
  external_payment_id,
  external_subscription_id,
  user_id,
  subscription_id,
  amount,
  currency,
  status,
  payment_method,
  payment_type,
  payer_email,
  paid_at
) 
SELECT 
  '143866525938',
  'ef17a06a76ec44bab86ae4f0e9824cae',
  '7d6503cb-8162-4786-960d-6233c46dcdb1',
  s.id,
  3.00,
  'BRL',
  'approved',
  'master',
  'subscription',
  'robson.gaeski@gmail.com',
  '2026-01-28T19:00:14+00:00'::timestamptz
FROM subscriptions s 
WHERE s.user_id = '7d6503cb-8162-4786-960d-6233c46dcdb1'
AND s.status = 'active'
ORDER BY s.created_at DESC
LIMIT 1
ON CONFLICT (external_payment_id) DO NOTHING;