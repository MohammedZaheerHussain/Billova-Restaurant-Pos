-- Add is_demo column to licenses table for demo account tracking
-- This enables:
-- 1. No extensions beyond demo period
-- 2. UI gating for demo vs real accounts
-- 3. Preventing downgrade abuse

ALTER TABLE licenses 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN licenses.is_demo IS 'Demo accounts have 3-day duration and auto-verified email. Cannot be extended.';
