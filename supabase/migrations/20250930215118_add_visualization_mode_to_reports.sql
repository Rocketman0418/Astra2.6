/*
  # Add Visualization Mode to Reports

  ## Overview
  Adds support for three report visualization modes to enhance mobile-first user experience.

  ## Changes
  1. New Column
    - `visualization_mode` (text) - Controls how reports are displayed
      - 'text' - Traditional text summary (legacy default)
      - 'insights_card' - Mobile-optimized 3-section highlights card (new default)
      - 'detailed_report' - Full detailed visualization
  
  2. Default Value
    - New reports default to 'insights_card' for optimal mobile experience
  
  ## Migration Safety
  - Uses ALTER TABLE ADD COLUMN IF NOT EXISTS pattern
  - Sets default value for new records
  - Existing reports default to 'text' mode for backward compatibility
*/

-- Add visualization_mode column to astra_reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'astra_reports' AND column_name = 'visualization_mode'
  ) THEN
    ALTER TABLE astra_reports 
    ADD COLUMN visualization_mode text DEFAULT 'insights_card' CHECK (visualization_mode IN ('text', 'insights_card', 'detailed_report'));
    
    -- Set existing reports to 'text' mode for backward compatibility
    UPDATE astra_reports SET visualization_mode = 'text' WHERE visualization_mode IS NULL;
  END IF;
END $$;
