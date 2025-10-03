/*
  # Enable pg_cron and Schedule Automated Report Execution

  1. Extension
    - Enable pg_cron extension for scheduling

  2. Scheduled Job
    - Create cron job to check for scheduled reports every hour
    - Calls the check-scheduled-reports edge function via pg_net (HTTP request)

  3. Notes
    - pg_cron runs jobs on a schedule using standard cron syntax
    - The job will run every hour at minute 0
    - Uses pg_net extension to make HTTP requests to the edge function
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for making HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the job to run every hour
-- This will call the check-scheduled-reports edge function
SELECT cron.schedule(
  'check-scheduled-reports-hourly',  -- job name
  '0 * * * *',                        -- every hour at minute 0
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/check-scheduled-reports',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
