-- Add new column to track when API call was initiated (helps detect timeouts)
ALTER TABLE public.send_logs 
ADD COLUMN IF NOT EXISTS api_call_started_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.send_logs.api_call_started_at IS 'Timestamp when the API call was initiated, used to detect false positives from timeouts';