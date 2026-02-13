import { useState, useEffect } from 'react';
import { supabase, subscribeChannel, unsubscribeChannel } from './supabase';
import { FeatureFlags } from './feature-flags';
import { logger } from '../utils/logger';

interface Order {
    id: string;
    order_number: number;
    status: string;
    order_type: string;
    table_number?: string;
    items: any[];
    total: number;
    created_at: string;
}

interface UseRealtimeOrdersReturn {
    orders: Order[];
    loading: boolean;
    error: string | null;
    isEnabled: boolean;
}

/**
 * Hook for realtime order updates via Supabase
 * Use for kitchen display, live order list, etc.
 */
export const useRealtimeOrders = (branchId: string): UseRealtimeOrdersReturn => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isEnabled = FeatureFlags.SUPABASE_REALTIME && FeatureFlags.SUPABASE_CONFIGURED;

    useEffect(() => {
        if (!isEnabled || !branchId) {
            setLoading(false);
            return;
        }

        // Fetch initial orders
        const fetchOrders = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const { data, error: fetchError } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('branch_id', branchId)
                    .gte('created_at', `${today}T00:00:00`)
                    .order('created_at', { ascending: false });

                if (fetchError) {
                    setError(fetchError.message);
                } else {
                    setOrders(data || []);
                }
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();

        // Subscribe to realtime changes
        const channelName = `billova:${branchId}:orders`;
        subscribeChannel(channelName, 'orders', (payload: any) => {
            logger.debug('[Realtime] Order change:', payload);

            if (payload.eventType === 'INSERT') {
                setOrders(prev => [payload.new as Order, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
                setOrders(prev => prev.map(o =>
                    o.id === payload.new.id ? (payload.new as Order) : o
                ));
            } else if (payload.eventType === 'DELETE') {
                setOrders(prev => prev.filter(o => o.id !== payload.old.id));
            }
        });

        return () => {
            unsubscribeChannel(channelName);
        };
    }, [branchId, isEnabled]);

    return { orders, loading, error, isEnabled };
};

/**
 * Hook for kitchen display - only pending/preparing orders
 */
export const useKitchenOrders = (branchId: string) => {
    const { orders, loading, error, isEnabled } = useRealtimeOrders(branchId);

    const kitchenOrders = orders.filter(o =>
        ['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status)
    );

    return { orders: kitchenOrders, loading, error, isEnabled };
};

export default useRealtimeOrders;
