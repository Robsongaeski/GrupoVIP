-- Corrigir valor do pagamento para R$5,00
UPDATE payments 
SET amount = 5.00 
WHERE external_payment_id = '143866525938';