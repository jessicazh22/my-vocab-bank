/*
  # Add usage_hint field to vocabulary

  1. Changes
    - Add `usage_hint` column to `vocabulary` table
    - This field stores guidance on when/how to use a word or sentence
    - Examples: "Use when describing wonder", "Great for formal settings"
    
  2. Notes
    - Optional text field, defaults to NULL
    - Complements the existing `context` field
    - Displayed during revise mode to reinforce learning
*/

ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS usage_hint text;