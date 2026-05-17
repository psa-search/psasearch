-- Add search_text column for efficient full-text search
ALTER TABLE psa_cards ADD COLUMN search_text TEXT;

-- Create index for performance
CREATE INDEX idx_psa_cards_search_text ON psa_cards USING GIN(to_tsvector('japanese', search_text));
