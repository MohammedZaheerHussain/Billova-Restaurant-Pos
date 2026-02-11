-- Fix profiles role check constraint to include SUPER_ADMIN
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add updated constraint with SUPER_ADMIN
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('SUPER_ADMIN', 'super_admin', 'owner', 'OWNER', 'manager', 'MANAGER', 'cashier', 'CASHIER', 'kitchen', 'KITCHEN', 'waiter', 'WAITER', 'driver', 'DRIVER'));

-- Now update the existing profile to SUPER_ADMIN
UPDATE profiles 
SET role = 'SUPER_ADMIN', name = 'Zaheer Hussain'
WHERE id = 'a6fc6522-3178-4fd3-b493-d01ff5781e37';

-- Verify
SELECT id, email, name, role, is_active FROM profiles 
WHERE id = 'a6fc6522-3178-4fd3-b493-d01ff5781e37';
