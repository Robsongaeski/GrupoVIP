-- Create cron job to sync all groups daily at 23:00 UTC (before snapshot at 23:59)
SELECT cron.schedule(
  'sync-all-groups-daily',
  '0 23 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://kwqjgflpphuvmduxukau.supabase.co/functions/v1/sync-all-groups',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3cWpnZmxwcGh1dm1kdXh1a2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzIzMTMsImV4cCI6MjA4MzcwODMxM30.0SQg8n6vlcADimuCjRaOLLMxjuOhtZy8U2tzwRm7dew"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);