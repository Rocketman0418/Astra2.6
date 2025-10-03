# Scheduled Reports Setup Guide

## Overview

Scheduled reports are now automatically executed by the `check-scheduled-reports` edge function. This function needs to be called by an external cron service every hour to check for and run any reports that are due.

## How It Works

1. **User Creates Scheduled Report**: When a user creates or edits a report with `schedule_type: 'scheduled'`, the system calculates `next_run_at` based on the frequency and time
2. **Cron Job Triggers**: An external cron service calls the edge function every hour
3. **Edge Function Checks**: The function queries for reports where `next_run_at` is in the past
4. **Reports Execute**: Each due report is sent to the n8n webhook for processing
5. **Results Saved**: Report results are saved to `astra_chats` table with `is_manual_run: false`
6. **Schedule Updated**: The `last_run_at` and `next_run_at` fields are updated

## Setting Up the Cron Job

You have several options for calling the edge function every hour:

### Option 1: cron-job.org (Free, Recommended)

1. Go to [cron-job.org](https://cron-job.org)
2. Create a free account
3. Create a new cron job with these settings:
   - **URL**: `https://<your-project-ref>.supabase.co/functions/v1/check-scheduled-reports`
   - **Schedule**: Every hour (0 * * * *)
   - **Method**: POST or GET
   - **Enabled**: Yes

### Option 2: EasyCron (Free tier available)

1. Go to [easycron.com](https://www.easycron.com)
2. Create account
3. Add new cron job:
   - **URL**: `https://<your-project-ref>.supabase.co/functions/v1/check-scheduled-reports`
   - **Cron Expression**: `0 * * * *` (every hour)

### Option 3: GitHub Actions (Free for public repos)

Create `.github/workflows/check-reports.yml`:

```yaml
name: Check Scheduled Reports
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  check-reports:
    runs-on: ubuntu-latest
    steps:
      - name: Call edge function
        run: |
          curl -X POST https://<your-project-ref>.supabase.co/functions/v1/check-scheduled-reports
```

### Option 4: Your Own Server

If you have your own server with cron:

```bash
# Add to crontab (crontab -e)
0 * * * * curl -X POST https://<your-project-ref>.supabase.co/functions/v1/check-scheduled-reports
```

## Edge Function URL

The edge function URL is:
```
https://<your-project-ref>.supabase.co/functions/v1/check-scheduled-reports
```

Replace `<your-project-ref>` with your actual Supabase project reference ID.

## Testing

### Manual Test
You can manually trigger the function to test it:

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/check-scheduled-reports
```

### Verify It's Working

1. Create a scheduled report in the UI
2. Check the database to verify `next_run_at` is set correctly
3. Manually call the edge function after the scheduled time has passed
4. Check the `astra_chats` table for the new report message
5. Verify `last_run_at` and `next_run_at` have been updated

## Monitoring

The edge function logs detailed information:
- Which reports need to run
- Success/failure for each report
- Next scheduled run time
- Any errors encountered

View logs in the Supabase Dashboard under Edge Functions > check-scheduled-reports > Logs

## Response Format

Successful response:
```json
{
  "success": true,
  "message": "Processed 2 report(s)",
  "successCount": 2,
  "failureCount": 0,
  "results": [
    {
      "reportId": "uuid",
      "reportTitle": "Daily News Brief",
      "success": true,
      "nextRunAt": "2025-10-04T13:00:00.000Z"
    }
  ],
  "checkedAt": "2025-10-03T14:05:00.000Z"
}
```

## Troubleshooting

### Reports not running
1. Check that `is_active` is `true` in `astra_reports` table
2. Verify `next_run_at` is in the past
3. Check edge function logs for errors
4. Ensure n8n webhook URL is configured correctly

### Wrong execution time
- The system uses Eastern Time for scheduling
- Accounts for EDT/EST automatically
- `next_run_at` is stored in UTC in the database

### Duplicate executions
- The function checks `next_run_at` and updates it immediately
- Running the function multiple times per hour is safe - it will only execute due reports once

## Current Status

✅ Edge function deployed: `check-scheduled-reports`
⏳ **Action Required**: Set up external cron job to call the function every hour

Once the cron job is configured, your scheduled reports will run automatically!
