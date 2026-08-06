-- ============================================
-- Add missing license_key column to branches
-- ============================================

ALTER TABLE branches ADD COLUMN IF NOT EXISTS license_key TEXT;
