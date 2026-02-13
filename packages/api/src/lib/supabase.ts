// Supabase Client for API (Service Role)
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    logger.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Service role client - bypasses RLS, use with caution
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// Helper type for database operations
export type DbResult<T> = {
    data: T | null;
    error: Error | null;
};

// Database table types (matching Supabase schema)
export interface Branch {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    gst_number?: string;
    is_active: boolean;
    subscription_plan: 'BASIC' | 'PLUS' | 'PREMIUM';
    subscription_expiry?: string;
    settings?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface Profile {
    id: string;
    org_id?: string;
    branch_id?: string;
    role: 'owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter';
    name: string;
    email?: string;
    phone?: string;
    pin_code?: string;
    is_active: boolean;
    permissions?: Record<string, unknown>;
    created_at: string;
}

export interface Category {
    id: string;
    branch_id: string;
    name: string;
    icon?: string;
    color?: string;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface MenuItem {
    id: string;
    branch_id: string;
    category_id?: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    is_veg: boolean;
    is_available: boolean;
    has_gst: boolean;
    gst_percent: number;
    sort_order: number;
    variants?: unknown[];
    addons?: unknown[];
    created_at: string;
    updated_at: string;
}

export interface Order {
    id: string;
    order_number: number;
    branch_id: string;
    table_id?: string;
    user_id?: string;
    order_type: 'DINE_IN' | 'TAKEAWAY' | 'ONLINE' | 'DELIVERY';
    status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
    customer_name?: string;
    customer_phone?: string;
    subtotal: number;
    discount_type?: 'PERCENTAGE' | 'FIXED';
    discount_value?: number;
    discount_amount: number;
    gst_amount: number;
    total: number;
    items?: unknown;
    notes?: string;
    offline_hash?: string;
    synced_from_offline: boolean;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

export interface InventoryItem {
    id: string;
    branch_id: string;
    sku?: string;
    name: string;
    category: string;
    unit: string;
    quantity: number;
    min_stock: number;
    safety_stock: number;
    reserved_qty: number;
    cost_per_unit: number;
    expiry_date?: string;
    stock_status: 'SUFFICIENT' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK';
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Table {
    id: string;
    branch_id: string;
    name: string;
    capacity: number;
    status: 'EMPTY' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
    qr_token?: string;
    created_at: string;
    updated_at: string;
}

// Utility functions
export async function getProfileByAuthId(authId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authId)
        .single();

    if (error) {
        logger.error('Error fetching profile:', error);
        return null;
    }
    return data;
}

export async function getBranchById(branchId: string): Promise<Branch | null> {
    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .single();

    if (error) {
        logger.error('Error fetching branch:', error);
        return null;
    }
    return data;
}

logger.info('✅ Supabase service client initialized');
