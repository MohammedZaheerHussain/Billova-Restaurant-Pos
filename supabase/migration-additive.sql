-- ============================================
-- BILLOVA POS - ADDITIVE SCHEMA MIGRATION
-- This ADDS missing tables to your existing schema
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add missing fields to branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'BASIC';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMPTZ;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS default_warehouse_id UUID;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add missing fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add missing fields to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- CREATE MISSING TABLES
-- ============================================

-- Menu Item Variants
CREATE TABLE IF NOT EXISTS menu_item_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variants_menu_item ON menu_item_variants(menu_item_id);

-- Menu Item Addons
CREATE TABLE IF NOT EXISTS menu_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    category TEXT DEFAULT 'Extras',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addons_branch ON menu_item_addons(branch_id);

-- Link table for menu items and addons
CREATE TABLE IF NOT EXISTS menu_item_addon_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES menu_item_addons(id) ON DELETE CASCADE,
    UNIQUE(menu_item_id, addon_id)
);

-- Tables (Dine-in)
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INT DEFAULT 4,
    status TEXT DEFAULT 'EMPTY' CHECK (status IN ('EMPTY', 'OCCUPIED', 'RESERVED', 'CLEANING')),
    qr_token TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch_id);

-- Order Items (normalized from JSONB)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES menu_item_variants(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Order Item Addons
CREATE TABLE IF NOT EXISTS order_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES menu_item_addons(id) ON DELETE SET NULL,
    price DECIMAL(10,2) NOT NULL
);

-- KOT Items
CREATE TABLE IF NOT EXISTS kot_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    kot_number INT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PREPARING', 'READY')),
    printed_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kot_items_order ON kot_items(order_id);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    is_main BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_branch ON warehouses(branch_id);

-- Warehouse Stock
CREATE TABLE IF NOT EXISTS warehouse_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) DEFAULT 0,
    min_stock DECIMAL(10,2),
    batch_number TEXT,
    expiry_date TIMESTAMPTZ,
    cost_price DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(warehouse_id, inventory_item_id)
);

-- Stock Transactions
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    previous_qty DECIMAL(10,3),
    new_qty DECIMAL(10,3),
    reason TEXT,
    order_id UUID,
    performed_by_id UUID,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_tx_item ON stock_transactions(inventory_item_id);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    payment_terms TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_branch ON suppliers(branch_id);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    po_number INT DEFAULT 0,
    status TEXT DEFAULT 'DRAFT',
    total_amount DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    ordered_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Licenses
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
    license_key TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'BASIC',
    status TEXT DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Combos
CREATE TABLE IF NOT EXISTS combos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS combo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id UUID REFERENCES combos(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INT DEFAULT 1
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(branch_id, key)
);

-- ============================================
-- ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE menu_item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_addon_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ADD RLS POLICIES FOR NEW TABLES
-- Service role gets full access
-- ============================================

-- Menu Variants
CREATE POLICY "service_role_variants" ON menu_item_variants FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "read_variants" ON menu_item_variants FOR SELECT TO authenticated
    USING (menu_item_id IN (SELECT id FROM menu_items WHERE branch_id = get_user_branch_id()));

-- Menu Addons
CREATE POLICY "service_role_addons" ON menu_item_addons FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "read_addons" ON menu_item_addons FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id());

-- Addon Links
CREATE POLICY "service_role_addon_links" ON menu_item_addon_links FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "read_addon_links" ON menu_item_addon_links FOR SELECT TO authenticated USING (true);

-- Tables
CREATE POLICY "service_role_tables" ON tables FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_tables" ON tables FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Order Items
CREATE POLICY "service_role_order_items" ON order_items FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_order_items" ON order_items FOR ALL TO authenticated
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- Order Item Addons
CREATE POLICY "service_role_oia" ON order_item_addons FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_oia" ON order_item_addons FOR ALL TO authenticated USING (true);

-- KOT Items
CREATE POLICY "service_role_kot" ON kot_items FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_kot" ON kot_items FOR ALL TO authenticated
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- Warehouses
CREATE POLICY "service_role_warehouses" ON warehouses FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_warehouses" ON warehouses FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Warehouse Stock
CREATE POLICY "service_role_wh_stock" ON warehouse_stock FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_wh_stock" ON warehouse_stock FOR SELECT TO authenticated USING (true);

-- Stock Transactions
CREATE POLICY "service_role_stock_tx" ON stock_transactions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_stock_tx" ON stock_transactions FOR SELECT TO authenticated USING (true);

-- Suppliers
CREATE POLICY "service_role_suppliers" ON suppliers FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_suppliers" ON suppliers FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Purchase Orders
CREATE POLICY "service_role_po" ON purchase_orders FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_po" ON purchase_orders FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Licenses
CREATE POLICY "service_role_licenses" ON licenses FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_licenses" ON licenses FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id());

-- Combos
CREATE POLICY "service_role_combos" ON combos FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_combos" ON combos FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Combo Items
CREATE POLICY "service_role_combo_items" ON combo_items FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_combo_items" ON combo_items FOR SELECT TO authenticated USING (true);

-- Settings
CREATE POLICY "service_role_settings" ON settings FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "users_settings" ON settings FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- ============================================
-- ADD REALTIME FOR NEW TABLES
-- ============================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    ALTER PUBLICATION supabase_realtime ADD TABLE tables;
EXCEPTION WHEN others THEN null;
END $$;

-- ============================================
-- DONE! Additive migration complete.
-- ============================================
SELECT 'Migration Complete: All missing tables added!' as status;
