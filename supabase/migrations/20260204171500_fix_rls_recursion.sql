-- Fix infinite recursion in profiles RLS policy
-- The previous policy tried to SELECT from profiles to check role, 
-- causing infinite recursion

-- Drop all existing policies
DROP POLICY IF EXISTS "Super admins can see all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can see own branch profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;

-- Simple policy: users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Simple policy: users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- Allow service role full access (for admin operations via API)
-- The service role key bypasses RLS anyway, but this is explicit

-- For super admin operations, we'll use the service role key in the API
-- which bypasses RLS entirely

SELECT 'RLS policies fixed!' as status;
