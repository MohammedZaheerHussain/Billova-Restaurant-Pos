-- ============================================
-- BILLOVA POS - SUPABASE SCHEMA (STEP 2)
-- Run this AFTER schema-step1-cleanup.sql
-- ============================================

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE subscription_plan AS ENUM ('BASIC', 'PLUS', 'PREMIUM');
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'DRIVER');
CREATE TYPE table_status AS ENUM ('EMPTY', 'OCCUPIED', 'RESERVED', 'CLEANING');
CREATE TYPE order_type AS ENUM ('DINE_IN', 'TAKEAWAY', 'ONLINE', 'DELIVERY');
CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');
CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE order_item_status AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
CREATE TYPE payment_mode AS ENUM ('CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'SPLIT');
CREATE TYPE kot_status AS ENUM ('PENDING', 'PREPARING', 'READY');
CREATE TYPE inventory_category AS ENUM ('INGREDIENT', 'PACKAGING', 'BEVERAGE', 'RAW_MATERIAL', 'FINISHED_GOODS', 'OTHER');
CREATE TYPE stock_status AS ENUM ('SUFFICIENT', 'LOW_STOCK', 'CRITICAL', 'OUT_OF_STOCK');
CREATE TYPE transaction_type AS ENUM ('PURCHASE', 'SALE', 'WASTAGE', 'ADJUSTMENT', 'CONSUMPTION', 'RESERVATION', 'RELEASE', 'BATCH_IMPORT', 'DAMAGE', 'EXPIRED', 'PRODUCTION_USE', 'TRANSFER_OUT', 'TRANSFER_IN', 'GRN_RECEIPT');
CREATE TYPE license_plan AS ENUM ('BASIC', 'PLUS', 'PREMIUM');
CREATE TYPE license_status AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');

-- ============================================
-- BRANCHES (Main Entity)
-- ============================================
CREATE TABLE branches (
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

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT,
    role user_role DEFAULT 'CASHIER',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE categories (
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

CREATE INDEX idx_categories_branch ON categories(branch_id);

-- ============================================
-- MENU ITEMS
-- ============================================
CREATE TABLE menu_items (
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

CREATE INDEX idx_menu_items_branch ON menu_items(branch_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);

-- ============================================
-- MENU ITEM VARIANTS
-- ============================================
CREATE TABLE menu_item_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MENU ITEM ADDONS
-- ============================================
CREATE TABLE menu_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    category TEXT DEFAULT 'Extras',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE menu_item_addon_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES menu_item_addons(id) ON DELETE CASCADE,
    UNIQUE(menu_item_id, addon_id)
);

-- ============================================
-- TABLES (Dine-in)
-- ============================================
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INT DEFAULT 4,
    status table_status DEFAULT 'EMPTY',
    qr_token TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tables_branch ON tables(branch_id);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number INT NOT NULL DEFAULT 0,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_type order_type DEFAULT 'DINE_IN',
    status order_status DEFAULT 'PENDING',
    customer_name TEXT,
    customer_phone TEXT,
    subtotal DECIMAL(10,2) NOT NULL,
    discount_type discount_type,
    discount_value DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    online_order_id TEXT,
    online_platform TEXT,
    offline_created_at TIMESTAMPTZ,
    offline_temp_bill_number TEXT,
    offline_hash TEXT UNIQUE,
    synced_from_offline BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_branch ON orders(branch_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE order_items (
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

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- ORDER ITEM ADDONS
-- ============================================
CREATE TABLE order_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES menu_item_addons(id) ON DELETE SET NULL,
    price DECIMAL(10,2) NOT NULL
);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    mode payment_mode NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_order ON payments(order_id);

-- ============================================
-- KOT ITEMS
-- ============================================
CREATE TABLE kot_items (
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

-- ============================================
-- INVENTORY ITEMS
-- ============================================
CREATE TABLE inventory_items (
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

CREATE INDEX idx_inventory_branch ON inventory_items(branch_id);

-- ============================================
-- STOCK TRANSACTIONS
-- ============================================
CREATE TABLE stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    previous_qty DECIMAL(10,3),
    new_qty DECIMAL(10,3),
    reason TEXT,
    order_id UUID,
    performed_by_id UUID,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- WAREHOUSES
-- ============================================
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    is_main BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- WAREHOUSE STOCK
-- ============================================
CREATE TABLE warehouse_stock (
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
CREATE TABLE suppliers (
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

-- ============================================
-- PURCHASE ORDERS
-- ============================================
CREATE TABLE purchase_orders (
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

-- ============================================
-- LICENSES
-- ============================================
CREATE TABLE licenses (
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
-- COMBOS
-- ============================================
CREATE TABLE combos (
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

CREATE TABLE combo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id UUID REFERENCES combos(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INT DEFAULT 1
);

-- ============================================
-- SETTINGS
-- ============================================
CREATE TABLE settings (
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
CREATE TABLE audit_logs (
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

-- ============================================
-- DAILY SUMMARIES
-- ============================================
CREATE TABLE daily_summaries (
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
CREATE TABLE order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- STEP 2 COMPLETE - Tables created!
-- Now run schema-step3-rls.sql
-- ============================================
SELECT 'Step 2 Complete: All tables created. Now run schema-step3-rls.sql' as status;
