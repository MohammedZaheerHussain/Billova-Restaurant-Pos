-- ============================================
-- BILLOVA POS - SUPABASE SCHEMA (CLEAN INSTALL)
-- Step 1: Run this FIRST to clean up
-- ============================================

-- Drop existing policies (they may reference old columns)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_updated_at_branches ON branches;
DROP TRIGGER IF EXISTS set_updated_at_users ON users;
DROP TRIGGER IF EXISTS set_updated_at_categories ON categories;
DROP TRIGGER IF EXISTS set_updated_at_menu_items ON menu_items;
DROP TRIGGER IF EXISTS set_updated_at_orders ON orders;
DROP TRIGGER IF EXISTS set_updated_at_inventory ON inventory_items;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_user_branch_id();
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS get_user_org_id();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS handle_new_user();

-- Remove tables from realtime (ignore errors)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS orders;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS order_events;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS order_items;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS inventory_items;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS tables;
EXCEPTION WHEN others THEN null;
END $$;

-- ============================================
-- DROP ALL EXISTING TABLES (CASCADE)
-- WARNING: This will delete all data!
-- ============================================
DROP TABLE IF EXISTS order_events CASCADE;
DROP TABLE IF EXISTS order_item_addons CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS kot_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_item_addon_links CASCADE;
DROP TABLE IF EXISTS menu_item_addons CASCADE;
DROP TABLE IF EXISTS menu_item_variants CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS combo_items CASCADE;
DROP TABLE IF EXISTS combos CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS stock_transactions CASCADE;
DROP TABLE IF EXISTS warehouse_stock CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS daily_summaries CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS licenses CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop old enums if they exist
DROP TYPE IF EXISTS subscription_plan CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS table_status CASCADE;
DROP TYPE IF EXISTS order_type CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS discount_type CASCADE;
DROP TYPE IF EXISTS order_item_status CASCADE;
DROP TYPE IF EXISTS payment_mode CASCADE;
DROP TYPE IF EXISTS kot_status CASCADE;
DROP TYPE IF EXISTS inventory_category CASCADE;
DROP TYPE IF EXISTS stock_status CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS license_plan CASCADE;
DROP TYPE IF EXISTS license_status CASCADE;

-- ============================================
-- STEP 1 COMPLETE - Now run schema-step2.sql
-- ============================================
SELECT 'Step 1 Complete: All tables dropped. Now run schema-step2.sql' as status;
