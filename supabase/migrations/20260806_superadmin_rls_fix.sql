-- ============================================
-- BILLOVA POS - SUPER ADMIN RLS FIX
-- Run this in Supabase SQL Editor
-- Fixes: SuperAdmin can't read/write branches because RLS
-- policies reference the wrong table and wrong case
-- ============================================

-- 1. Create a helper function that checks profiles table for super_admin
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND LOWER(role) = 'super_admin'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Drop old restrictive branches policies
DROP POLICY IF EXISTS "users_read_own_branch" ON branches;
DROP POLICY IF EXISTS "super_admin_full_access_branches" ON branches;
DROP POLICY IF EXISTS "super_admin_insert_branches" ON branches;
DROP POLICY IF EXISTS "super_admin_update_branches" ON branches;
DROP POLICY IF EXISTS "super_admin_delete_branches" ON branches;
DROP POLICY IF EXISTS "users_read_own_branch_v2" ON branches;

-- 3. Super Admin: Full read access to ALL branches
CREATE POLICY "super_admin_full_access_branches" ON branches
    FOR SELECT TO authenticated
    USING (is_super_admin());

-- 4. Super Admin: Can create new branches (restaurants)
CREATE POLICY "super_admin_insert_branches" ON branches
    FOR INSERT TO authenticated
    WITH CHECK (is_super_admin());

-- 5. Super Admin: Can update any branch
CREATE POLICY "super_admin_update_branches" ON branches
    FOR UPDATE TO authenticated
    USING (is_super_admin());

-- 6. Super Admin: Can delete branches
CREATE POLICY "super_admin_delete_branches" ON branches
    FOR DELETE TO authenticated
    USING (is_super_admin());

-- 7. Regular users: Can still read their own branch
CREATE POLICY "users_read_own_branch_v2" ON branches
    FOR SELECT TO authenticated
    USING (
        id = get_user_branch_id()
        OR get_user_role() = 'OWNER'
    );

-- ============================================
-- PROFILES TABLE: Super admin needs INSERT for new owners
-- ============================================
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "super_admin_manage_profiles" ON profiles;

-- Super Admin: Can insert new profiles (when creating restaurant owners)
CREATE POLICY "super_admin_insert_profiles" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (is_super_admin());

-- Super Admin: Can update/manage all profiles
CREATE POLICY "super_admin_manage_profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (is_super_admin());

-- ============================================
-- SUPPORT TICKETS: Super admin access
-- ============================================
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_tickets" ON support_tickets;
DROP POLICY IF EXISTS "super_admin_update_tickets" ON support_tickets;
DROP POLICY IF EXISTS "users_create_tickets" ON support_tickets;
DROP POLICY IF EXISTS "users_read_own_tickets" ON support_tickets;

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

-- ============================================
-- PASSWORD RESET REQUESTS: Super admin access
-- ============================================
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_resets" ON password_reset_requests;
DROP POLICY IF EXISTS "super_admin_update_resets" ON password_reset_requests;
DROP POLICY IF EXISTS "users_create_resets" ON password_reset_requests;

CREATE POLICY "super_admin_read_resets" ON password_reset_requests
    FOR SELECT TO authenticated
    USING (is_super_admin());

CREATE POLICY "super_admin_update_resets" ON password_reset_requests
    FOR UPDATE TO authenticated
    USING (is_super_admin());

CREATE POLICY "users_create_resets" ON password_reset_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ============================================
-- VERIFY: Check current super admin profile
-- ============================================
SELECT id, email, role, branch_id, is_active
FROM profiles
WHERE LOWER(role) = 'super_admin';

SELECT 'Super Admin RLS fix applied successfully!' AS status;
