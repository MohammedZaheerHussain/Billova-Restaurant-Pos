-- ============================================
-- BILLOVA POS - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- BRANCH & ORGANIZATION
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    gst_number TEXT,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- USER PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id),
    branch_id UUID REFERENCES branches(id),
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'kitchen', 'waiter')),
    name TEXT NOT NULL,
    phone TEXT,
    pin_code TEXT,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MENU & CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🍽️',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_veg BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    has_gst BOOLEAN DEFAULT true,
    gst_percent DECIMAL(5,2) DEFAULT 5,
    variants JSONB DEFAULT '[]',
    addons JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ORDERS (APPEND-ONLY for clients!)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    branch_id UUID REFERENCES branches(id),
    order_number INT NOT NULL,
    bill_number TEXT,
    order_type TEXT CHECK (order_type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ONLINE')),
    status TEXT DEFAULT 'PENDING',
    table_number TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    synced_from_offline BOOLEAN DEFAULT false,
    offline_hash TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

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
-- PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    amount DECIMAL(10,2) NOT NULL,
    method TEXT CHECK (method IN ('CASH', 'CARD', 'UPI', 'SPLIT')),
    reference TEXT,
    received_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INVENTORY (READ-ONLY MIRROR)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    quantity DECIMAL(10,3) DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    min_stock DECIMAL(10,3) DEFAULT 0,
    cost_price DECIMAL(10,2),
    linked_menu_item_id UUID REFERENCES menu_items(id),
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    change_qty DECIMAL(10,3),
    reason TEXT,
    reference_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AUDIT & REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),
    user_id UUID,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),
    date DATE NOT NULL,
    total_orders INT DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    cash_amount DECIMAL(12,2) DEFAULT 0,
    card_amount DECIMAL(12,2) DEFAULT 0,
    upi_amount DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    top_items JSONB DEFAULT '[]',
    hourly_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(branch_id, date)
);

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 🔴 CRITICAL: REVOKE CLIENT WRITES ON PROTECTED TABLES
-- ============================================

-- Orders: Clients can ONLY read
REVOKE INSERT, UPDATE, DELETE ON orders FROM authenticated;
GRANT SELECT ON orders TO authenticated;

-- Order Events: Append-only by service role
REVOKE INSERT, UPDATE, DELETE ON order_events FROM authenticated;
GRANT SELECT ON order_events TO authenticated;

-- Payments: Read-only for clients
REVOKE INSERT, UPDATE, DELETE ON payments FROM authenticated;
GRANT SELECT ON payments TO authenticated;

-- Inventory: Read-only mirror
REVOKE INSERT, UPDATE, DELETE ON inventory_items FROM authenticated;
GRANT SELECT ON inventory_items TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON inventory_logs FROM authenticated;
GRANT SELECT ON inventory_logs TO authenticated;

-- Audit logs: Read-only
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM authenticated;
GRANT SELECT ON audit_logs TO authenticated;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION get_user_branch_id() RETURNS UUID AS $$
    SELECT COALESCE(
        ((auth.jwt()->'app_metadata'->>'branch_id')::UUID),
        (SELECT branch_id FROM profiles WHERE id = auth.uid())
    );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_org_id() RETURNS UUID AS $$
    SELECT COALESCE(
        ((auth.jwt()->'app_metadata'->>'org_id')::UUID),
        (SELECT org_id FROM profiles WHERE id = auth.uid())
    );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
    SELECT COALESCE(
        (auth.jwt()->'app_metadata'->>'role'),
        (SELECT role FROM profiles WHERE id = auth.uid())
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles: Users see their own org
CREATE POLICY "profiles_read_own_org" ON profiles FOR SELECT
    USING (org_id = get_user_org_id());

-- Branches: Users see their own org branches
CREATE POLICY "branches_read_own_org" ON branches FOR SELECT
    USING (org_id = get_user_org_id());

-- Categories: Branch-scoped
CREATE POLICY "categories_read_branch" ON categories FOR SELECT
    USING (branch_id = get_user_branch_id() OR get_user_role() = 'owner');

CREATE POLICY "categories_write_manager" ON categories FOR ALL
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('owner', 'manager'));

-- Menu Items: Branch-scoped read, manager+ write
CREATE POLICY "menu_read_branch" ON menu_items FOR SELECT
    USING (branch_id = get_user_branch_id() OR get_user_role() = 'owner');

CREATE POLICY "menu_write_manager" ON menu_items FOR ALL
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('owner', 'manager'));

-- Orders: Read own branch, owner reads all org
CREATE POLICY "orders_read_branch" ON orders FOR SELECT
    USING (branch_id = get_user_branch_id());

CREATE POLICY "orders_read_owner_org" ON orders FOR SELECT
    USING (
        get_user_role() = 'owner' 
        AND branch_id IN (SELECT id FROM branches WHERE org_id = get_user_org_id())
    );

-- Service role bypasses all (for Node backend)
CREATE POLICY "service_role_all_orders" ON orders FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "service_role_all_order_events" ON order_events FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "service_role_all_payments" ON payments FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "service_role_all_inventory" ON inventory_items FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "service_role_all_inventory_logs" ON inventory_logs FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "service_role_all_audit" ON audit_logs FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Inventory read policies for clients
CREATE POLICY "inventory_read_branch" ON inventory_items FOR SELECT
    USING (branch_id = get_user_branch_id() OR get_user_role() = 'owner');

CREATE POLICY "inventory_logs_read_branch" ON inventory_logs FOR SELECT
    USING (branch_id = get_user_branch_id() OR get_user_role() = 'owner');

-- Order events read
CREATE POLICY "order_events_read_branch" ON order_events FOR SELECT
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- Payments read
CREATE POLICY "payments_read_branch" ON payments FOR SELECT
    USING (branch_id = get_user_branch_id() OR get_user_role() = 'owner');

-- Daily summaries
CREATE POLICY "summaries_read_branch" ON daily_summaries FOR SELECT
    USING (branch_id = get_user_branch_id() OR get_user_role() = 'owner');

-- Audit logs (owner only)
CREATE POLICY "audit_read_owner" ON audit_logs FOR SELECT
    USING (get_user_role() = 'owner' AND branch_id IN (SELECT id FROM branches WHERE org_id = get_user_org_id()));

-- ============================================
-- AUTH TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, role, org_id, branch_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'cashier'),
        (NEW.raw_user_meta_data->>'org_id')::UUID,
        (NEW.raw_user_meta_data->>'branch_id')::UUID
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ENABLE REALTIME FOR KEY TABLES
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_events;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
