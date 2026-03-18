
-- Add execution_id to send_logs for traceability
ALTER TABLE public.send_logs ADD COLUMN IF NOT EXISTS execution_id text;

-- Create unique index to prevent duplicate active sends for same campaign_item + group
-- Only one non-failed log per combination (allows multiple failed attempts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_send_logs_unique_active_send 
ON public.send_logs (campaign_id, campaign_item_id, group_id) 
WHERE status IN ('pending', 'sent');
