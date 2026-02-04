import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not set. Supabase features disabled.');
}

// Public client for frontend use
export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
);

// Max 3 channels per client (cost + stability)
const MAX_CHANNELS = 3;
const activeChannels = new Map<string, ReturnType<typeof supabase.channel>>();

/**
 * Subscribe to a realtime channel with automatic limit enforcement
 */
export const subscribeChannel = (
    name: string,
    table: string,
    handler: (payload: any) => void
) => {
    if (activeChannels.size >= MAX_CHANNELS) {
        console.error(`[Supabase] Channel limit (${MAX_CHANNELS}) reached. Unsubscribe from an existing channel first.`);
        return null;
    }

    if (activeChannels.has(name)) {
        console.warn(`[Supabase] Channel ${name} already exists`);
        return activeChannels.get(name)!;
    }

    const channel = supabase
        .channel(name)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            handler
        )
        .subscribe((status: string) => {
            console.log(`[Supabase] Channel ${name} status: ${status}`);
        });

    activeChannels.set(name, channel);
    return channel;
};

/**
 * Unsubscribe from a channel
 */
export const unsubscribeChannel = (name: string) => {
    const channel = activeChannels.get(name);
    if (channel) {
        channel.unsubscribe();
        activeChannels.delete(name);
        console.log(`[Supabase] Unsubscribed from ${name}`);
    }
};

/**
 * Unsubscribe from all channels
 */
export const unsubscribeAllChannels = () => {
    activeChannels.forEach((channel, name) => {
        channel.unsubscribe();
        console.log(`[Supabase] Unsubscribed from ${name}`);
    });
    activeChannels.clear();
};

/**
 * Get current channel count
 */
export const getChannelCount = () => activeChannels.size;

// Types for Supabase tables (generated from schema)
export type Database = {
    public: {
        Tables: {
            orders: {
                Row: {
                    id: string;
                    branch_id: string;
                    order_number: number;
                    bill_number: string | null;
                    order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';
                    status: string;
                    table_number: string | null;
                    customer_name: string | null;
                    customer_phone: string | null;
                    items: any;
                    subtotal: number;
                    discount_amount: number;
                    gst_amount: number;
                    total: number;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                    synced_from_offline: boolean;
                    offline_hash: string | null;
                };
            };
            order_events: {
                Row: {
                    id: string;
                    order_id: string;
                    event: string;
                    payload: any;
                    created_by: string | null;
                    created_at: string;
                };
            };
            inventory_items: {
                Row: {
                    id: string;
                    branch_id: string;
                    name: string;
                    sku: string | null;
                    quantity: number;
                    unit: string;
                    min_stock: number;
                    cost_price: number | null;
                    linked_menu_item_id: string | null;
                    last_synced_at: string;
                    created_at: string;
                    updated_at: string;
                };
            };
            profiles: {
                Row: {
                    id: string;
                    org_id: string | null;
                    branch_id: string | null;
                    role: 'owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter';
                    name: string;
                    phone: string | null;
                    pin_code: string | null;
                    is_active: boolean;
                    permissions: any;
                    created_at: string;
                };
            };
        };
    };
};

export default supabase;
