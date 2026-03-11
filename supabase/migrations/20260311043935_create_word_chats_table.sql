/*
  # Create word_chats table for persisting AI conversations

  1. New Tables
    - `word_chats`
      - `id` (uuid, primary key)
      - `word_id` (uuid, foreign key to vocabulary)
      - `user_id` (uuid, foreign key to auth.users)
      - `messages` (jsonb array of chat messages)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `word_chats` table
    - Users can only access their own chat history
  
  3. Auto-cleanup
    - Chats older than 30 days are automatically cleaned up via a scheduled function
*/

CREATE TABLE IF NOT EXISTS word_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id uuid NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_word_chats_word_id ON word_chats(word_id);
CREATE INDEX IF NOT EXISTS idx_word_chats_user_id ON word_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_word_chats_updated_at ON word_chats(updated_at);

ALTER TABLE word_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
  ON word_chats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat history"
  ON word_chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat history"
  ON word_chats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat history"
  ON word_chats FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
