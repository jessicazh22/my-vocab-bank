/*
  # Create vocabulary practice table

  1. New Tables
    - `vocabulary`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - for multi-user support
      - `word` (text) - the word or phrase to learn
      - `definition` (text) - the definition
      - `example_sentence` (text, nullable) - optional example sentence
      - `category` (text) - KNOW_WELL, LEARNING, or JUST_ADDED
      - `added_date` (timestamptz) - when the word was added
      - `practice_count` (integer) - number of times practiced
      - `last_practiced` (timestamptz, nullable) - last practice date
      - `user_sentences` (jsonb) - array of sentences user wrote during practice
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `vocabulary` table
    - Add policy for authenticated users to read their own words
    - Add policy for authenticated users to insert their own words
    - Add policy for authenticated users to update their own words
    - Add policy for authenticated users to delete their own words
*/

CREATE TABLE IF NOT EXISTS vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word text NOT NULL,
  definition text NOT NULL,
  example_sentence text,
  category text NOT NULL DEFAULT 'JUST_ADDED',
  added_date timestamptz DEFAULT now() NOT NULL,
  practice_count integer DEFAULT 0 NOT NULL,
  last_practiced timestamptz,
  user_sentences jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vocabulary"
  ON vocabulary FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary"
  ON vocabulary FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocabulary"
  ON vocabulary FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocabulary"
  ON vocabulary FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_category ON vocabulary(category);
CREATE INDEX IF NOT EXISTS idx_vocabulary_added_date ON vocabulary(added_date DESC);