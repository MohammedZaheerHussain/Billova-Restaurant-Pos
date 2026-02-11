-- ============================================
-- BILLOVA POS - COMPLETE SUPABASE SCHEMA
-- Full migration from MySQL/Prisma to Supabase
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- DROP EXISTING TABLES (IF MIGRATING)
-- Uncomment if you want to start fresh
-- ============================================
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT ALL ON SCHEMA public TO postgres;
-- GRANT ALL ON SCHEMA public TO public;

-- ============================================
-- ENUMS (PostgreSQL Style)
-- ============================================
DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('BASIC', 'PLUS', 'PREMIUM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'DRIVER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE table_status AS ENUM ('EMPTY', 'OCCUPIED', 'RESERVED', 'CLEANING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_type AS ENUM ('DINE_IN', 'TAKEAWAY', 'ONLINE', 'DELIVERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FIXED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_item_status AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_mode AS ENUM ('CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'SPLIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kot_status AS ENUM ('PENDING', 'PREPARING', 'READY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE inventory_category AS ENUM ('INGREDIENT', 'PACKAGING', 'BEVERAGE', 'RAW_MATERIAL', 'FINISHED_GOODS', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stock_status AS ENUM ('SUFFICIENT', 'LOW_STOCK', 'CRITICAL', 'OUT_OF_STOCK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('PURCHASE', 'SALE', 'WASTAGE', 'ADJUSTMENT', 'CONSUMPTION', 'RESERVATION', 'RELEASE', 'BATCH_IMPORT', 'DAMAGE', 'EXPIRED', 'PRODUCTION_USE', 'TRANSFER_OUT', 'TRANSFER_IN', 'GRN_RECEIPT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE license_plan AS ENUM ('BASIC', 'PLUS', 'PREMIUM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE license_status AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- BRANCHES (Main Entity)
-- ============================================
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    is_active BOOLEAN DEFAULT true,
    subscription_plan subscription_plan DEFAULT 'BASIC',
    subscription_expiry TIMESTAMPTZ,
    default_warehouse_id UUID,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(is_active);

-- ============================================
-- USERS (Linked to Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT, -- For backward compatibility, will phase out
    role user_role DEFAULT 'CASHIER',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🍽️',
    color TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_branch ON categories(branch_id);

-- ============================================
-- MENU ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image TEXT,
    is_veg BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    has_gst BOOLEAN DEFAULT true,
    gst_percent DECIMAL(5,2) DEFAULT 5,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_branch ON menu_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

-- ============================================
-- MENU ITEM VARIANTS
-- ============================================
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

-- ============================================
-- MENU ITEM ADDONS
-- ============================================
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

-- ============================================
-- TABLES (Dine-in)
-- ============================================
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INT DEFAULT 4,
    status table_status DEFAULT 'EMPTY',
    qr_token TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch_id);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number INT NOT NULL DEFAULT 0,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_type order_type DEFAULT 'DINE_IN',
    status order_status DEFAULT 'PENDING',
    customer_name TEXT,
    customer_phone TEXT,
    
    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    discount_type discount_type,
    discount_value DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Online order info
    online_order_id TEXT,
    online_platform TEXT,
    
    -- Offline sync info
    offline_created_at TIMESTAMPTZ,
    offline_temp_bill_number TEXT,
    offline_hash TEXT UNIQUE,
    synced_from_offline BOOLEAN DEFAULT false,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES menu_item_variants(id) ON DELETE SET NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    notes TEXT,
    status order_item_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);

-- ============================================
-- ORDER ITEM ADDONS (Selected addons)
-- ============================================
CREATE TABLE IF NOT EXISTS order_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES menu_item_addons(id) ON DELETE SET NULL,
    price DECIMAL(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_item_addons_order_item ON order_item_addons(order_item_id);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    mode payment_mode NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ============================================
-- KOT ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS kot_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    kot_number INT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INT NOT NULL,
    notes TEXT,
    status kot_status DEFAULT 'PENDING',
    printed_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kot_items_order ON kot_items(order_id);

-- ============================================
-- INVENTORY ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    sku TEXT,
    name TEXT NOT NULL,
    category inventory_category DEFAULT 'INGREDIENT',
    unit TEXT DEFAULT 'pcs',
    quantity DECIMAL(10,3) DEFAULT 0,
    min_stock DECIMAL(10,3) DEFAULT 0,
    safety_stock DECIMAL(10,3) DEFAULT 0,
    reserved_qty DECIMAL(10,3) DEFAULT 0,
    cost_per_unit DECIMAL(10,2) DEFAULT 0,
    expiry_date TIMESTAMPTZ,
    stock_status stock_status DEFAULT 'SUFFICIENT',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);

-- ============================================
-- STOCK TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    previous_qty DECIMAL(10,3),
    new_qty DECIMAL(10,3),
    reason TEXT,
    order_id UUID,
    performed_by_id UUID,
    approved_by_id UUID,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_item ON stock_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(type);

-- ============================================
-- WAREHOUSES
-- ============================================
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

-- ============================================
-- WAREHOUSE STOCK
-- ============================================
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

-- ============================================
-- SUPPLIERS
-- ============================================
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

-- ============================================
-- PURCHASE ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    po_number INT DEFAULT 0,
    status TEXT DEFAULT 'DRAFT',
    total_amount DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    ordered_by UUID,
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);

-- ============================================
-- LICENSES
-- ============================================
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
    license_key TEXT UNIQUE NOT NULL,
    plan license_plan DEFAULT 'BASIC',
    status license_status DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- COMBOS / OFFERS
-- ============================================
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

-- ============================================
-- SETTINGS
-- ============================================
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
-- AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- DAILY SUMMARIES (Reports)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_orders INT DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    cash_amount DECIMAL(12,2) DEFAULT 0,
    card_amount DECIMAL(12,2) DEFAULT 0,
    upi_amount DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    top_items JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(branch_id, date)
);

-- ============================================
-- ORDER EVENTS (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_addon_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION get_user_branch_id() RETURNS UUID AS $$
    SELECT COALESCE(
        ((auth.jwt()->'app_metadata'->>'branch_id')::UUID),
        (SELECT branch_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
    SELECT COALESCE(
        (auth.jwt()->'app_metadata'->>'role'),
        (SELECT role::TEXT FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES - Service Role Full Access
-- ============================================

-- Branches
CREATE POLICY "service_role_branches" ON branches FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_own_branch" ON branches FOR SELECT
    USING (id = get_user_branch_id() OR get_user_role() = 'OWNER' OR get_user_role() = 'SUPER_ADMIN');

-- Users
CREATE POLICY "service_role_users" ON users FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_own_branch_users" ON users FOR SELECT
    USING (branch_id = get_user_branch_id());

-- Categories
CREATE POLICY "service_role_categories" ON categories FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_branch_categories" ON categories FOR SELECT
    USING (branch_id = get_user_branch_id());

CREATE POLICY "managers_manage_categories" ON categories FOR ALL
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('OWNER', 'MANAGER'));

-- Menu Items
CREATE POLICY "service_role_menu_items" ON menu_items FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_menu_items" ON menu_items FOR SELECT
    USING (branch_id = get_user_branch_id());

CREATE POLICY "managers_manage_menu_items" ON menu_items FOR ALL
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('OWNER', 'MANAGER'));

-- Orders
CREATE POLICY "service_role_orders" ON orders FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_orders" ON orders FOR SELECT
    USING (branch_id = get_user_branch_id());

CREATE POLICY "cashiers_create_orders" ON orders FOR INSERT
    WITH CHECK (branch_id = get_user_branch_id());

CREATE POLICY "staff_update_orders" ON orders FOR UPDATE
    USING (branch_id = get_user_branch_id());

-- Order Items
CREATE POLICY "service_role_order_items" ON order_items FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_manage_order_items" ON order_items FOR ALL
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- Payments
CREATE POLICY "service_role_payments" ON payments FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_manage_payments" ON payments FOR ALL
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- Inventory
CREATE POLICY "service_role_inventory" ON inventory_items FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_inventory" ON inventory_items FOR SELECT
    USING (branch_id = get_user_branch_id());

CREATE POLICY "managers_manage_inventory" ON inventory_items FOR ALL
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('OWNER', 'MANAGER'));

-- Tables
CREATE POLICY "service_role_tables" ON tables FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_manage_tables" ON tables FOR ALL
    USING (branch_id = get_user_branch_id());

-- Warehouses
CREATE POLICY "service_role_warehouses" ON warehouses FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_manage_warehouses" ON warehouses FOR ALL
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('OWNER', 'MANAGER'));

-- Settings
CREATE POLICY "service_role_settings" ON settings FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "managers_manage_settings" ON settings FOR ALL
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('OWNER', 'MANAGER'));

-- Audit Logs
CREATE POLICY "service_role_audit" ON audit_logs FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "owners_read_audit" ON audit_logs FOR SELECT
    USING (branch_id = get_user_branch_id() AND get_user_role() = 'OWNER');

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_updated_at_branches BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_categories BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_menu_items BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_inventory BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE REALTIME FOR KEY TABLES
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_events;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE tables;

-- ============================================
-- AUTO-CREATE USER PROFILE ON AUTH SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (auth_id, name, email, role, branch_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CASHIER'),
        (NEW.raw_user_meta_data->>'branch_id')::UUID
    );
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log error but don't fail auth
        RAISE WARNING 'Failed to create user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- DONE! Run this schema in Supabase SQL Editor
-- ============================================
