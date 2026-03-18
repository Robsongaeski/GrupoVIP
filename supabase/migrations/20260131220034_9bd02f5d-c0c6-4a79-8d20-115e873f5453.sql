-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule daily snapshot at 23:59 (Brazil time - America/Sao_Paulo)
SELECT cron.schedule(
  'record-daily-group-snapshots',
  '59 23 * * *',  -- Every day at 23:59
  $$SELECT public.record_daily_group_snapshots()$$
);