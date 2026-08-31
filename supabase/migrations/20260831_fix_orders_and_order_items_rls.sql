-- ==============================================================================
-- BILLOVA POS - FIX ORDERS, ORDER ITEMS, PAYMENTS SCHEMA & RLS POLICIES
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ==============================================================================

-- 1. Ensure 'orders' table has all required columns and constraints
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number INT DEFAULT 1,
    daily_order_no INT DEFAULT 1,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    user_id UUID,
    order_type TEXT DEFAULT 'DINE_IN',
    status TEXT DEFAULT 'PENDING',
    customer_name TEXT,
    customer_phone TEXT,
    subtotal DECIMAL(10,2) DEFAULT 0,
    discount_type TEXT,
    discount_value DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    payment_method TEXT DEFAULT 'CASH',
    notes TEXT,
    online_order_id TEXT,
    online_platform TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Add any missing columns to existing orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INT DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS daily_order_no INT DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES tables(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'DINE_IN';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS online_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS online_platform TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Ensure 'order_items' table exists with all columns
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID,
    variant_id UUID,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS menu_item_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Ensure 'payments' table exists with all columns
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'CASH',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 4. Create indexes for high-speed queries
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- 5. Set up Row-Level Security (RLS) Policies on 'orders'
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_orders" ON orders;
DROP POLICY IF EXISTS "users_read_orders" ON orders;
DROP POLICY IF EXISTS "cashiers_create_orders" ON orders;
DROP POLICY IF EXISTS "staff_update_orders" ON orders;
DROP POLICY IF EXISTS "authenticated_orders_all" ON orders;
DROP POLICY IF EXISTS "anon_orders_insert" ON orders;
DROP POLICY IF EXISTS "anon_orders_select" ON orders;

CREATE POLICY "service_role_orders" ON orders
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_orders_all" ON orders
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "anon_orders_insert" ON orders
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "anon_orders_select" ON orders
    FOR SELECT TO anon
    USING (true);

-- 6. Set up RLS Policies on 'order_items'
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_order_items" ON order_items;
DROP POLICY IF EXISTS "users_manage_order_items" ON order_items;
DROP POLICY IF EXISTS "authenticated_order_items_all" ON order_items;
DROP POLICY IF EXISTS "anon_order_items_all" ON order_items;

CREATE POLICY "service_role_order_items" ON order_items
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_order_items_all" ON order_items
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "anon_order_items_all" ON order_items
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- 7. Set up RLS Policies on 'payments'
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_payments" ON payments;
DROP POLICY IF EXISTS "users_manage_payments" ON payments;
DROP POLICY IF EXISTS "authenticated_payments_all" ON payments;

CREATE POLICY "service_role_payments" ON payments
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_payments_all" ON payments
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 8. Enable Realtime Publications
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE payments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
