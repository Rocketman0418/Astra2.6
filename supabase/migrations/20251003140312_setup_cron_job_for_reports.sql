/*
  # Setup Automated Scheduled Report Execution with pg_cron

  1. Remove existing job if any
  2. Create new cron job that runs every hour
  3. The job makes an HTTP POST request to the check-scheduled-reports edge function

  Note: This replaces the need for external cron services
*/

-- Remove existing job if it exists
SELECT cron.unschedule('check-scheduled-reports-hourly') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-scheduled-reports-hourly'
);

-- Create the cron job with hardcoded URL
SELECT cron.schedule(
  'check-scheduled-reports-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/check-scheduled-reports',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
