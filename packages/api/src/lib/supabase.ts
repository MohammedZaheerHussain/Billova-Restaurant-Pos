import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[Supabase] Environment variables not set. Shadow writes disabled.');
}

/**
 * Supabase Admin Client (Service Role)
 * 
 * ⚠️ CRITICAL: This client bypasses RLS!
 * Use ONLY in Node.js backend, NEVER expose to frontend.
 * 
 * Use for:
 * - Shadow-writing orders from MySQL to Supabase
 * - Creating order_events
 * - Syncing inventory state
 * - Writing audit logs
 */
export const supabaseAdmin = createClient(
    supabaseUrl || '',
    supabaseServiceKey || '',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

/**
 * Check if Supabase is configured
 */
export const isSupabaseConfigured = (): boolean => {
    return !!(supabaseUrl && supabaseServiceKey);
};

/**
 * Shadow-write an order to Supabase
 * Non-blocking, logs errors but doesn't fail
 */
export const shadowWriteOrder = async (order: any): Promise<void> => {
    if (!isSupabaseConfigured()) return;

    try {
        const { error } = await supabaseAdmin
            .from('orders')
            .upsert({
                id: order.id,
                branch_id: order.branchId,
                order_number: order.orderNumber,
                bill_number: order.billNumber,
                order_type: order.orderType,
                status: order.status,
                table_number: order.tableNumber,
                customer_name: order.customerName,
                customer_phone: order.customerPhone,
                items: order.items,
                subtotal: order.subtotal,
                discount_amount: order.discountAmount || 0,
                gst_amount: order.gstAmount || 0,
                total: order.total,
                created_by: order.createdBy,
                created_at: order.createdAt,
                updated_at: order.updatedAt || new Date().toISOString(),
                synced_from_offline: order.syncedFromOffline || false,
                offline_hash: order.offlineHash
            }, {
                onConflict: 'id'
            });

        if (error) {
            console.error('[Supabase] Shadow write order failed:', error.message);
        } else {
            console.log(`[Supabase] Order ${order.id} synced to cloud`);
        }
    } catch (e) {
        console.error('[Supabase] Shadow write order exception:', e);
    }
};

/**
 * Create order event for audit trail
 */
export const createOrderEvent = async (
    orderId: string,
    event: string,
    payload: any = {},
    createdBy?: string
): Promise<void> => {
    if (!isSupabaseConfigured()) return;

    try {
        const { error } = await supabaseAdmin
            .from('order_events')
            .insert({
                order_id: orderId,
                event,
                payload,
                created_by: createdBy
            });

        if (error) {
            console.error('[Supabase] Create order event failed:', error.message);
        }
    } catch (e) {
        console.error('[Supabase] Create order event exception:', e);
    }
};

/**
 * Sync inventory item to Supabase
 */
export const syncInventoryItem = async (item: any): Promise<void> => {
    if (!isSupabaseConfigured()) return;

    try {
        const { error } = await supabaseAdmin
            .from('inventory_items')
            .upsert({
                id: item.id,
                branch_id: item.branchId,
                name: item.name,
                sku: item.sku,
                quantity: item.quantity,
                unit: item.unit,
                min_stock: item.minStock,
                cost_price: item.costPrice,
                linked_menu_item_id: item.linkedMenuItemId,
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            });

        if (error) {
            console.error('[Supabase] Sync inventory failed:', error.message);
        }
    } catch (e) {
        console.error('[Supabase] Sync inventory exception:', e);
    }
};

/**
 * Create inventory log entry
 */
export const createInventoryLog = async (
    itemId: string,
    branchId: string,
    changeQty: number,
    reason: string,
    referenceId?: string,
    createdBy?: string
): Promise<void> => {
    if (!isSupabaseConfigured()) return;

    try {
        const { error } = await supabaseAdmin
            .from('inventory_logs')
            .insert({
                item_id: itemId,
                branch_id: branchId,
                change_qty: changeQty,
                reason,
                reference_id: referenceId,
                created_by: createdBy
            });

        if (error) {
            console.error('[Supabase] Create inventory log failed:', error.message);
        }
    } catch (e) {
        console.error('[Supabase] Create inventory log exception:', e);
    }
};

/**
 * Create audit log entry
 */
export const createAuditLog = async (
    branchId: string,
    userId: string | undefined,
    action: string,
    entity: string,
    entityId: string,
    oldData?: any,
    newData?: any,
    ipAddress?: string
): Promise<void> => {
    if (!isSupabaseConfigured()) return;

    try {
        const { error } = await supabaseAdmin
            .from('audit_logs')
            .insert({
                branch_id: branchId,
                user_id: userId,
                action,
                entity,
                entity_id: entityId,
                old_data: oldData,
                new_data: newData,
                ip_address: ipAddress
            });

        if (error) {
            console.error('[Supabase] Create audit log failed:', error.message);
        }
    } catch (e) {
        console.error('[Supabase] Create audit log exception:', e);
    }
};

export default supabaseAdmin;
