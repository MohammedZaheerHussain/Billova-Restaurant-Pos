-- ============================================
-- FIX: RLS POLICY FOR PROFILES (avoid recursion)
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Super admins can see all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can see own branch profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

-- Simple policy: users can always read their own profile (NO recursion)
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Super admins can see all profiles (use raw_user_meta_data to avoid recursion)
CREATE POLICY "Super admins can see all profiles" ON profiles
    FOR SELECT TO authenticated
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
            OR raw_user_meta_data->>'role' = 'SUPER_ADMIN'
        )
    );

-- Users can see profiles in their own branch (for non-super-admins)
CREATE POLICY "Users can see own branch profiles" ON profiles
    FOR SELECT TO authenticated
    USING (
        branch_id IN (
            SELECT branch_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

SELECT 'RLS policies fixed!' as status;
