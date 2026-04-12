/*
  # Add is_archived column to vocabulary table
  
  Adds support for archiving words without deleting them.
*/

ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_vocabulary_is_archived ON vocabulary(is_archived);
