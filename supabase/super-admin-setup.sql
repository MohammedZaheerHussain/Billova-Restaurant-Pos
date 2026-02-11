-- ============================================
-- BILLOVA POS - SUPER ADMIN SETUP
-- Run AFTER creating tables and AFTER creating user in Supabase Auth
-- ============================================

-- ============================================
-- STEP 1: First, go to Supabase Dashboard -> Authentication
-- Click "Add User" and create a user with:
--   Email: YOUR_EMAIL@example.com
--   Password: YOUR_SECURE_PASSWORD
--   (Check "Auto Confirm User")
-- ============================================

-- ============================================  
-- STEP 2: Get the user's ID from Supabase Auth UI
-- Then run this SQL with the actual UUID:
-- ============================================

-- Replace 'PUT_USER_ID_HERE' with actual UUID from auth.users
-- Replace 'YOUR_EMAIL@example.com' with your email

/*
INSERT INTO profiles (id, email, name, role, is_active)
VALUES (
    'PUT_USER_ID_HERE'::uuid,
    'YOUR_EMAIL@example.com',
    'Super Admin',
    'super_admin',
    true
)
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    name = 'Super Admin',
    is_active = true;
*/

-- ============================================
-- ALTERNATIVE: If profile was auto-created, just update role
-- ============================================

/*
UPDATE profiles
SET role = 'super_admin', name = 'Super Admin'
WHERE email = 'YOUR_EMAIL@example.com';
*/

-- ============================================
-- VERIFY SUPER ADMIN
-- ============================================

SELECT id, email, name, role, is_active, created_at
FROM profiles
WHERE role = 'super_admin';
