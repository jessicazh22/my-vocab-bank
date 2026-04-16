/*
  # Add collocations column to vocabulary table

  Stores common word pairings (verb+word, adverb+word, word+noun) as JSONB.
  Structure: { pairs: [{ phrase: string, note?: string }], summary?: string }
*/

ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS collocations JSONB;
