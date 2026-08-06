-- ============================================
-- BILLOVA POS - ENABLE RLS ON REMAINING TABLES
-- Run this in Supabase SQL Editor
-- Fixes: profiles and warehouse_stocks tables have
-- RLS policies but RLS is not enabled
-- ============================================

-- Fix 1: Enable RLS on profiles table
-- (policies already exist from the previous migration)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Fix 2: Enable RLS on warehouse_stocks table
ALTER TABLE warehouse_stocks ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for warehouse_stocks
DROP POLICY IF EXISTS "service_role_warehouse_stocks" ON warehouse_stocks;
DROP POLICY IF EXISTS "users_read_own_branch_warehouse_stocks" ON warehouse_stocks;
DROP POLICY IF EXISTS "managers_manage_warehouse_stocks" ON warehouse_stocks;
DROP POLICY IF EXISTS "super_admin_warehouse_stocks" ON warehouse_stocks;

CREATE POLICY "service_role_warehouse_stocks" ON warehouse_stocks
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_own_branch_warehouse_stocks" ON warehouse_stocks
    FOR SELECT TO authenticated
    USING (
        warehouse_id IN (
            SELECT id FROM warehouses WHERE branch_id = get_user_branch_id()
        )
    );

CREATE POLICY "managers_manage_warehouse_stocks" ON warehouse_stocks
    FOR ALL TO authenticated
    USING (
        warehouse_id IN (
            SELECT id FROM warehouses WHERE branch_id = get_user_branch_id()
        )
        AND get_user_role() IN ('OWNER', 'MANAGER')
    );

CREATE POLICY "super_admin_warehouse_stocks" ON warehouse_stocks
    FOR ALL TO authenticated
    USING (is_super_admin());

SELECT 'RLS enabled on profiles and warehouse_stocks!' AS status;
