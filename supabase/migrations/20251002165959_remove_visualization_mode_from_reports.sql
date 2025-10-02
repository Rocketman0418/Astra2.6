/*
  # Remove visualization_mode field from reports table

  1. Changes
    - Remove the `visualization_mode` column from `astra_reports` table
    - All reports will now automatically generate visual dashboards

  2. Rationale
    - Simplifies the report creation UX by removing user choice of display format
    - All reports will automatically generate and display visualizations by default
    - Users can still toggle to see text summary if preferred
*/

-- Remove visualization_mode column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'astra_reports' AND column_name = 'visualization_mode'
  ) THEN
    ALTER TABLE astra_reports DROP COLUMN visualization_mode;
  END IF;
END $$;