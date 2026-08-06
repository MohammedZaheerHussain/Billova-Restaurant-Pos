-- ============================================
-- BILLOVA POS - FIX PROFILES RLS RECURSION
-- Run this in Supabase SQL Editor
-- 
-- Problem: Enabling RLS on profiles caused circular dependency.
-- Old policies use inline subqueries like:
--   (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
-- This queries profiles FROM WITHIN a profiles policy → infinite loop → 403
--
-- Fix: Use SECURITY DEFINER helper functions (bypass RLS) instead.
-- ============================================

-- Step 1: Create SECURITY DEFINER helper to get current user's branch_id
-- (bypasses RLS since it runs as function owner)
CREATE OR REPLACE FUNCTION get_my_branch_id() RETURNS UUID AS $$
    SELECT branch_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 2: Drop ALL existing profiles policies (they cause recursion)
DROP POLICY IF EXISTS "Super admins can see all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can see own branch profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_read_own_org" ON profiles;
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "super_admin_manage_profiles" ON profiles;
DROP POLICY IF EXISTS "super_admin_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "super_admin_update_all_profiles" ON profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_read_branch_profiles" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "service_role_profiles" ON profiles;

-- Step 3: Create clean, non-recursive policies

-- Service role: full access (for backend/admin operations)
CREATE POLICY "service_role_profiles" ON profiles
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Self-read: every user can always see their own profile
CREATE POLICY "users_read_own_profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Branch-read: users can see profiles in their branch
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "users_read_branch_profiles" ON profiles
    FOR SELECT TO authenticated
    USING (branch_id IS NOT NULL AND branch_id = get_my_branch_id());

-- Super admin: can see ALL profiles
-- Uses is_super_admin() which is SECURITY DEFINER
CREATE POLICY "super_admin_read_all_profiles" ON profiles
    FOR SELECT TO authenticated
    USING (is_super_admin());

-- Self-update: users can update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- Super admin: can insert new profiles (creating restaurant owners)
CREATE POLICY "super_admin_insert_profiles" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (is_super_admin());

-- Super admin: can update any profile
CREATE POLICY "super_admin_update_all_profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (is_super_admin());

-- Super admin: can delete profiles
CREATE POLICY "super_admin_delete_profiles" ON profiles
    FOR DELETE TO authenticated
    USING (is_super_admin());

-- Step 4: Fix support_tickets policies (ensure they work with profiles RLS)
-- Drop and recreate to be clean
DROP POLICY IF EXISTS "super_admin_read_tickets" ON support_tickets;
DROP POLICY IF EXISTS "super_admin_update_tickets" ON support_tickets;
DROP POLICY IF EXISTS "users_create_tickets" ON support_tickets;
DROP POLICY IF EXISTS "users_read_own_tickets" ON support_tickets;
DROP POLICY IF EXISTS "service_role_tickets" ON support_tickets;

CREATE POLICY "service_role_tickets" ON support_tickets
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "super_admin_read_tickets" ON support_tickets
    FOR SELECT TO authenticated
    USING (is_super_admin());

CREATE POLICY "super_admin_update_tickets" ON support_tickets
    FOR UPDATE TO authenticated
    USING (is_super_admin());

CREATE POLICY "users_create_tickets" ON support_tickets
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_read_own_tickets" ON support_tickets
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Step 5: Fix password_reset_requests policies
DROP POLICY IF EXISTS "super_admin_read_resets" ON password_reset_requests;
DROP POLICY IF EXISTS "super_admin_update_resets" ON password_reset_requests;
DROP POLICY IF EXISTS "users_create_resets" ON password_reset_requests;
DROP POLICY IF EXISTS "service_role_resets" ON password_reset_requests;

CREATE POLICY "service_role_resets" ON password_reset_requests
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "super_admin_read_resets" ON password_reset_requests
    FOR SELECT TO authenticated
    USING (is_super_admin());

CREATE POLICY "super_admin_update_resets" ON password_reset_requests
    FOR UPDATE TO authenticated
    USING (is_super_admin());

CREATE POLICY "users_create_resets" ON password_reset_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

SELECT 'Profiles RLS recursion fixed! All policies now use SECURITY DEFINER helpers.' AS status;
