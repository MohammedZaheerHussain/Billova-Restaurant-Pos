-- Set user as Super Admin
-- User UID: a6fc6522-3178-4fd3-b493-d01ff5781e37

INSERT INTO profiles (id, email, name, role, is_active)
VALUES (
    'a6fc6522-3178-4fd3-b493-d01ff5781e37'::uuid,
    'mohammedzaheerhussain2002@gmail.com',
    'Zaheer Hussain',
    'super_admin',
    true
)
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    name = 'Zaheer Hussain',
    is_active = true;

-- Verify
SELECT id, email, name, role, is_active FROM profiles WHERE role = 'super_admin';
