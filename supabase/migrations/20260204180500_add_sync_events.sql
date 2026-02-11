-- Migration: sync_events table for cloud sync tracking
-- This table provides idempotency, audit, and retry control

CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- ORDER, PAYMENT, KOT, ORDER_STATUS, CANCELLED_ITEM
  entity_id UUID,
  local_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | success | failed
  attempt_count INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_events_branch ON sync_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_idempotency ON sync_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(entity_type, branch_id);

-- RLS Policies
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their branch's sync events
CREATE POLICY "Users can view own branch sync events" ON sync_events
    FOR SELECT TO authenticated
    USING (
        branch_id IN (
            SELECT branch_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Add offline sync columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS synced_from_offline BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offline_local_id TEXT;

-- Index for finding offline-synced orders
CREATE INDEX IF NOT EXISTS idx_orders_offline ON orders(offline_local_id) WHERE offline_local_id IS NOT NULL;

-- Service role can insert/update (used by API)
-- Service role key bypasses RLS

COMMENT ON TABLE sync_events IS 'Tracks sync operations for idempotency, audit, and retry control';

