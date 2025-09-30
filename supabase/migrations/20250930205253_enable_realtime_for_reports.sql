/*
  # Enable Real-time for Reports Table

  1. Changes
    - Enable real-time replication for astra_reports table
    - This allows real-time subscriptions to receive INSERT, UPDATE, and DELETE events
    - Ensures immediate UI updates across all components when reports are created or modified

  2. Notes
    - Real-time respects existing RLS policies
    - Users will only receive updates for their own reports
*/

-- Enable real-time for astra_reports table
ALTER PUBLICATION supabase_realtime ADD TABLE astra_reports;
