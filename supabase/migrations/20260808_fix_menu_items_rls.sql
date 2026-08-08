-- ============================================
-- BILLOVA POS - FIX MENU ITEMS & CATEGORIES RLS & HELPER FUNCTIONS
-- ============================================

-- 1. Fix get_user_branch_id() to check profiles table ONLY (no legacy users table)
CREATE OR REPLACE FUNCTION get_user_branch_id() RETURNS UUID AS $$
    SELECT branch_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Fix get_user_role() to check profiles table ONLY
CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
    SELECT COALESCE(
        (SELECT role::TEXT FROM profiles WHERE id = auth.uid() LIMIT 1),
        'OWNER'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Update RLS policies on menu_items
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_menu_items" ON menu_items;
DROP POLICY IF EXISTS "users_read_menu_items" ON menu_items;
DROP POLICY IF EXISTS "managers_write_menu_items" ON menu_items;
DROP POLICY IF EXISTS "managers_manage_menu_items" ON menu_items;
DROP POLICY IF EXISTS "authenticated_manage_menu_items" ON menu_items;

CREATE POLICY "service_role_menu_items" ON menu_items FOR ALL TO service_role USING (true);

CREATE POLICY "users_read_menu_items" ON menu_items
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_manage_menu_items" ON menu_items
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Update RLS policies on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_categories" ON categories;
DROP POLICY IF EXISTS "users_read_categories" ON categories;
DROP POLICY IF EXISTS "managers_write_categories" ON categories;
DROP POLICY IF EXISTS "authenticated_manage_categories" ON categories;

CREATE POLICY "service_role_categories" ON categories FOR ALL TO service_role USING (true);

CREATE POLICY "users_read_categories" ON categories
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_manage_categories" ON categories
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
