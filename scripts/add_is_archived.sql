-- Add is_archived column to vocabulary table
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
