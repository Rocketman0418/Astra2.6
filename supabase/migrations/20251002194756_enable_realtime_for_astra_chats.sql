/*
  # Enable Real-time for astra_chats Table
  
  This migration enables real-time subscriptions for the astra_chats table,
  allowing the UI to automatically update when report visualizations are generated
  without requiring manual page refreshes.
  
  ## Changes
  - Enables real-time replication for astra_chats table
  
  ## Impact
  - UI will now automatically update when:
    - New report messages are inserted
    - Visualization data is added to existing messages
    - Metadata changes (like visualization_generating flag)
*/

-- Enable real-time for astra_chats table
ALTER PUBLICATION supabase_realtime ADD TABLE astra_chats;
