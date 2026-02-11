-- Add missing columns to existing tables
-- Run this in Supabase SQL Editor or via CLI

-- Add sort_order to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- Add sort_order to categories  
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- Ensure profiles table has all necessary fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add missing fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID';

-- Add missing fields to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS has_gst BOOLEAN DEFAULT true;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS gst_percent DECIMAL(5,2) DEFAULT 5;

-- Add code to suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS code TEXT;

-- Create warehouse_stocks table if it doesn't exist
CREATE TABLE IF NOT EXISTS warehouse_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) DEFAULT 0,
    min_stock DECIMAL(10,2),
    batch_number TEXT,
    bin_id UUID,
    expiry_date TIMESTAMPTZ,
    cost_price DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(warehouse_id, inventory_item_id)
);

SELECT 'Schema fix complete' as status;
