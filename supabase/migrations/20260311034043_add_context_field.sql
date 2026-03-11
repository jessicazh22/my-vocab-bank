/*
  # Add context field to vocabulary

  1. Changes
    - Add `context` column to `vocabulary` table
    - This field stores usage context information (e.g., business settings, casual conversation)
    
  2. Notes
    - Optional text field, defaults to NULL
    - Useful for understanding when/how to use a word appropriately
*/

ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS context text;