-- Remove existing cron job if exists
SELECT cron.unschedule('process-scheduled-campaigns') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-campaigns'
);

-- Schedule the cron job to run every minute
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kwqjgflpphuvmduxukau.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3cWpnZmxwcGh1dm1kdXh1a2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzIzMTMsImV4cCI6MjA4MzcwODMxM30.0SQg8n6vlcADimuCjRaOLLMxjuOhtZy8U2tzwRm7dew"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);