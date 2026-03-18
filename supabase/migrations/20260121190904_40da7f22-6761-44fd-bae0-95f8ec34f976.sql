-- Remove the specific false positive for VIP Update #09 campaign item 1
-- This log was incorrectly created as "failed" when the message was actually sent
DELETE FROM send_logs 
WHERE id = '2c4d9709-6ec3-4034-b0d4-c4822aea305f';