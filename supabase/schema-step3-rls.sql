-- ============================================
-- BILLOVA POS - SUPABASE SCHEMA (STEP 3)
-- Run this AFTER schema-step2-tables.sql
-- RLS Policies and Helper Functions
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
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
    SELECT branch_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
    SELECT role::TEXT FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Auto update updated_at
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
-- RLS POLICIES: Service Role has full access
-- ============================================

-- Branches
CREATE POLICY "service_role_branches" ON branches FOR ALL TO service_role USING (true);
CREATE POLICY "users_read_own_branch" ON branches FOR SELECT TO authenticated 
    USING (id = get_user_branch_id() OR get_user_role() IN ('OWNER', 'SUPER_ADMIN'));

-- Users  
CREATE POLICY "service_role_users" ON users FOR ALL TO service_role USING (true);
CREATE POLICY "users_read_own_branch_users" ON users FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id());

-- Categories
CREATE POLICY "service_role_categories" ON categories FOR ALL TO service_role USING (true);
CREATE POLICY "users_read_categories" ON categories FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id());
CREATE POLICY "managers_write_categories" ON categories FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('OWNER', 'MANAGER'));

-- Menu Items
CREATE POLICY "service_role_menu_items" ON menu_items FOR ALL TO service_role USING (true);
CREATE POLICY "users_read_menu_items" ON menu_items FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id());
CREATE POLICY "managers_write_menu_items" ON menu_items FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('OWNER', 'MANAGER'));

-- Menu Variants
CREATE POLICY "service_role_variants" ON menu_item_variants FOR ALL TO service_role USING (true);
CREATE POLICY "users_variants" ON menu_item_variants FOR ALL TO authenticated
    USING (menu_item_id IN (SELECT id FROM menu_items WHERE branch_id = get_user_branch_id()));

-- Menu Addons
CREATE POLICY "service_role_addons" ON menu_item_addons FOR ALL TO service_role USING (true);
CREATE POLICY "users_addons" ON menu_item_addons FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Addon Links
CREATE POLICY "service_role_addon_links" ON menu_item_addon_links FOR ALL TO service_role USING (true);
CREATE POLICY "users_addon_links" ON menu_item_addon_links FOR ALL TO authenticated USING (true);

-- Tables
CREATE POLICY "service_role_tables" ON tables FOR ALL TO service_role USING (true);
CREATE POLICY "users_tables" ON tables FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Orders
CREATE POLICY "service_role_orders" ON orders FOR ALL TO service_role USING (true);
CREATE POLICY "users_read_orders" ON orders FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id());
CREATE POLICY "users_create_orders" ON orders FOR INSERT TO authenticated
    WITH CHECK (branch_id = get_user_branch_id());
CREATE POLICY "users_update_orders" ON orders FOR UPDATE TO authenticated
    USING (branch_id = get_user_branch_id());

-- Order Items
CREATE POLICY "service_role_order_items" ON order_items FOR ALL TO service_role USING (true);
CREATE POLICY "users_order_items" ON order_items FOR ALL TO authenticated
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- Order Item Addons
CREATE POLICY "service_role_oia" ON order_item_addons FOR ALL TO service_role USING (true);
CREATE POLICY "users_oia" ON order_item_addons FOR ALL TO authenticated USING (true);

-- Payments
CREATE POLICY "service_role_payments" ON payments FOR ALL TO service_role USING (true);
CREATE POLICY "users_payments" ON payments FOR ALL TO authenticated
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- KOT Items
CREATE POLICY "service_role_kot" ON kot_items FOR ALL TO service_role USING (true);
CREATE POLICY "users_kot" ON kot_items FOR ALL TO authenticated
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- Inventory
CREATE POLICY "service_role_inventory" ON inventory_items FOR ALL TO service_role USING (true);
CREATE POLICY "users_read_inventory" ON inventory_items FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id());
CREATE POLICY "managers_write_inventory" ON inventory_items FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id() AND get_user_role() IN ('OWNER', 'MANAGER'));

-- Stock Transactions
CREATE POLICY "service_role_stock_tx" ON stock_transactions FOR ALL TO service_role USING (true);
CREATE POLICY "users_stock_tx" ON stock_transactions FOR ALL TO authenticated USING (true);

-- Warehouses
CREATE POLICY "service_role_warehouses" ON warehouses FOR ALL TO service_role USING (true);
CREATE POLICY "users_warehouses" ON warehouses FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Warehouse Stock
CREATE POLICY "service_role_wh_stock" ON warehouse_stock FOR ALL TO service_role USING (true);
CREATE POLICY "users_wh_stock" ON warehouse_stock FOR ALL TO authenticated USING (true);

-- Suppliers
CREATE POLICY "service_role_suppliers" ON suppliers FOR ALL TO service_role USING (true);
CREATE POLICY "users_suppliers" ON suppliers FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Purchase Orders
CREATE POLICY "service_role_po" ON purchase_orders FOR ALL TO service_role USING (true);
CREATE POLICY "users_po" ON purchase_orders FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Licenses
CREATE POLICY "service_role_licenses" ON licenses FOR ALL TO service_role USING (true);
CREATE POLICY "users_licenses" ON licenses FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id());

-- Combos
CREATE POLICY "service_role_combos" ON combos FOR ALL TO service_role USING (true);
CREATE POLICY "users_combos" ON combos FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Combo Items
CREATE POLICY "service_role_combo_items" ON combo_items FOR ALL TO service_role USING (true);
CREATE POLICY "users_combo_items" ON combo_items FOR ALL TO authenticated USING (true);

-- Settings
CREATE POLICY "service_role_settings" ON settings FOR ALL TO service_role USING (true);
CREATE POLICY "users_settings" ON settings FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Audit Logs
CREATE POLICY "service_role_audit" ON audit_logs FOR ALL TO service_role USING (true);
CREATE POLICY "owners_audit" ON audit_logs FOR SELECT TO authenticated
    USING (branch_id = get_user_branch_id() AND get_user_role() = 'OWNER');

-- Daily Summaries
CREATE POLICY "service_role_summaries" ON daily_summaries FOR ALL TO service_role USING (true);
CREATE POLICY "users_summaries" ON daily_summaries FOR ALL TO authenticated
    USING (branch_id = get_user_branch_id());

-- Order Events
CREATE POLICY "service_role_events" ON order_events FOR ALL TO service_role USING (true);
CREATE POLICY "users_events" ON order_events FOR ALL TO authenticated
    USING (order_id IN (SELECT id FROM orders WHERE branch_id = get_user_branch_id()));

-- ============================================
-- AUTO-CREATE USER ON SIGNUP
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
EXCEPTION WHEN others THEN
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE tables;

-- ============================================
-- DONE! Schema complete.
-- ============================================
SELECT 'Step 3 Complete: RLS Policies and Realtime enabled. Schema ready!' as status;
