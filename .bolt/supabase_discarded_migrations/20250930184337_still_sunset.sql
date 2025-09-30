/*
  # Create Pending Reports View for N8N Workflow

  1. New View
    - `pending_reports_for_n8n` - View that returns reports ready to be executed
    - Filters for active reports where next_run_at <= current time
    - Includes all necessary fields for N8N workflow execution

  2. Security
    - No RLS needed as this is a view for system use
    - N8N will use service role key to access this
*/

-- Create a view for N8N to query pending reports
CREATE OR REPLACE VIEW pending_reports_for_n8n AS
SELECT 
  r.id,
  r.user_id,
  r.title,
  r.prompt,
  r.schedule_type,
  r.schedule_frequency,
  r.schedule_time,
  r.next_run_at,
  r.last_run_at,
  r.is_active,
  r.created_at,
  r.updated_at,
  -- Get user details for the report execution
  u.email as user_email,
  u.name as user_name
FROM astra_reports r
LEFT JOIN auth.users au ON r.user_id = au.id
LEFT JOIN users u ON r.user_id = u.id
WHERE 
  r.is_active = true 
  AND r.schedule_type = 'scheduled'
  AND r.next_run_at IS NOT NULL
  AND r.next_run_at <= NOW()
ORDER BY r.next_run_at ASC;

-- Grant access to the service role
GRANT SELECT ON pending_reports_for_n8n TO service_role;