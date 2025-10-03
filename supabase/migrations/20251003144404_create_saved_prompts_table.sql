/*
  # Create Saved Prompts Table

  1. New Tables
    - `astra_saved_prompts`
      - `id` (uuid, primary key) - Unique identifier for the saved prompt
      - `user_id` (uuid, foreign key) - References auth.users
      - `prompt_text` (text) - The saved prompt/question text
      - `created_at` (timestamptz) - When the prompt was saved
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `astra_saved_prompts` table
    - Add policy for users to read their own saved prompts
    - Add policy for users to create their own saved prompts
    - Add policy for users to delete their own saved prompts

  3. Indexes
    - Index on user_id for fast lookups
    - Index on created_at for sorting

  4. Notes
    - Users can only access their own saved prompts
    - Prompts are ordered by creation date (newest first)
    - This replaces localStorage-based favorites with database persistence
*/

-- Create the saved prompts table
CREATE TABLE IF NOT EXISTS astra_saved_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_text text NOT NULL CHECK (length(TRIM(prompt_text)) > 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_id 
  ON astra_saved_prompts(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_prompts_created_at 
  ON astra_saved_prompts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE astra_saved_prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own saved prompts
CREATE POLICY "Users can view own saved prompts"
  ON astra_saved_prompts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create their own saved prompts
CREATE POLICY "Users can create own saved prompts"
  ON astra_saved_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own saved prompts
CREATE POLICY "Users can delete own saved prompts"
  ON astra_saved_prompts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_prompts_updated_at_trigger ON astra_saved_prompts;

CREATE TRIGGER update_saved_prompts_updated_at_trigger
  BEFORE UPDATE ON astra_saved_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_prompts_updated_at();
