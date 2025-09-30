/*
  # Add schedule day field to reports

  1. Changes
    - Add `schedule_day` column to `astra_reports` table
      - For weekly reports: stores day of week (0-6, where 0 is Sunday)
      - For monthly reports: stores day of month (1-31)
      - NULL for daily reports
  
  2. Notes
    - This field is optional and only used for weekly/monthly reports
    - Existing daily reports will have NULL value (which is correct)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'astra_reports' AND column_name = 'schedule_day'
  ) THEN
    ALTER TABLE astra_reports ADD COLUMN schedule_day INTEGER;
  END IF;
END $$;