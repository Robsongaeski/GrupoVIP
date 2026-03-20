-- Fixes missing idempotency constraint on send_logs table
DELETE FROM public.send_logs a USING public.send_logs b 
WHERE a.id > b.id 
  AND a.campaign_id = b.campaign_id 
  AND a.campaign_item_id = b.campaign_item_id 
  AND a.group_id = b.group_id;

ALTER TABLE public.send_logs
  ADD CONSTRAINT send_logs_idempotency_key UNIQUE (campaign_id, campaign_item_id, group_id);
