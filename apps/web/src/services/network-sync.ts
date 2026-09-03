// Network Sync Service - Auto-syncs offline orders when network returns
import { syncLocalOrdersToSupabase, getStoredLocalOrders } from '../api/orders';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

let isSyncRunning = false;
let syncListenerAttached = false;
let heartbeatTimer: any = null;

export async function triggerAutoSync(): Promise<number> {
    if (isSyncRunning || typeof navigator === 'undefined' || !navigator.onLine) {
        return 0;
    }

    try {
        isSyncRunning = true;
        const count = await syncLocalOrdersToSupabase();
        if (count > 0) {
            logger.info(`[AutoSync] Successfully synced ${count} offline orders to Supabase!`);
            toast.success(`Synced ${count} offline order${count > 1 ? 's' : ''} to cloud!`, {
                id: 'offline-sync-toast',
            });
        }
        return count;
    } catch (err) {
        logger.warn('[AutoSync] Background sync error:', err);
        return 0;
    } finally {
        isSyncRunning = false;
    }
}

/**
 * Get count of pending offline orders for current tenant
 */
export function getPendingOfflineOrderCount(branchId?: string): number {
    const list = getStoredLocalOrders(branchId);
    return list.filter(o => o.id && (o.id.startsWith('ord-') || o.id.startsWith('temp-'))).length;
}

/**
 * Initialize automatic background network synchronization
 */
export function initNetworkSync() {
    if (syncListenerAttached || typeof window === 'undefined') return;
    syncListenerAttached = true;

    // 1. Listen for browser online event
    window.addEventListener('online', () => {
        logger.info('[NetworkSync] Network connection restored. Starting sync...');
        triggerAutoSync();
    });

    // 2. Periodic background heartbeat every 30 seconds
    if (!heartbeatTimer) {
        heartbeatTimer = setInterval(() => {
            if (navigator.onLine) {
                const pending = getPendingOfflineOrderCount();
                if (pending > 0) {
                    triggerAutoSync();
                }
            }
        }, 30000);
    }

    // 3. Trigger initial sync on mount if online
    if (navigator.onLine) {
        setTimeout(() => triggerAutoSync(), 2000);
    }
}
