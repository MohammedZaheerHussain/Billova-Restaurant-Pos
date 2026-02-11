// useSync Hook - Hook for managing sync operations
import { useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useSyncStore } from '../store/sync-store';
import syncEngine from '../sync/sync-engine';

export interface UseSyncOptions {
    autoSyncOnReconnect?: boolean;
    autoSyncInterval?: number; // ms, 0 to disable
}

const DEFAULT_OPTIONS: UseSyncOptions = {
    autoSyncOnReconnect: true,
    autoSyncInterval: 60000, // 1 minute
};

export function useSync(options: UseSyncOptions = DEFAULT_OPTIONS) {
    const { isOnline, wasOffline } = useNetworkStatus();
    const { status, pendingOrders, pendingPayments, lastSyncAt, setOnline } = useSyncStore();
    const intervalRef = useRef<number | null>(null);

    // Update online status in store
    useEffect(() => {
        setOnline(isOnline);
    }, [isOnline, setOnline]);

    // Auto-sync on reconnect
    useEffect(() => {
        if (options.autoSyncOnReconnect && wasOffline && isOnline) {
            console.log('[useSync] Reconnected, triggering auto-sync...');
            syncEngine.syncAll();
        }
    }, [wasOffline, isOnline, options.autoSyncOnReconnect]);

    // Auto-sync interval
    useEffect(() => {
        if (options.autoSyncInterval && options.autoSyncInterval > 0) {
            intervalRef.current = window.setInterval(() => {
                if (isOnline) {
                    syncEngine.syncAll();
                }
            }, options.autoSyncInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [options.autoSyncInterval, isOnline]);

    // Update pending counts on mount
    useEffect(() => {
        syncEngine.updatePendingCounts().catch((e) => {
            console.warn('[useSync] Failed to update pending counts on mount:', e);
        });
    }, []);

    // Manual sync trigger
    const triggerSync = useCallback(async () => {
        if (!isOnline) {
            console.log('[useSync] Cannot sync while offline');
            return { totalSynced: 0, totalFailed: 0, totalSkipped: 0, errors: ['Device is offline'] };
        }
        return syncEngine.manualSync();
    }, [isOnline]);

    // Cancel sync
    const cancelSync = useCallback(() => {
        syncEngine.cancelSync();
    }, []);

    // Construct sync info from store state
    const pendingCount = pendingOrders + pendingPayments;

    return {
        status,
        isOnline,
        pendingCount,
        lastSyncTime: lastSyncAt ? new Date(lastSyncAt) : null,
        hasErrors: status === 'blocked',
        triggerSync,
        cancelSync,
        updatePendingCounts: syncEngine.updatePendingCounts.bind(syncEngine),
    };
}

// Simple hook for just the sync status badge
export function useSyncStatus() {
    const { status, pendingOrders, pendingPayments, lastSyncAt } = useSyncStore();
    const { isOnline } = useNetworkStatus();
    const pendingCount = pendingOrders + pendingPayments;

    return {
        status,
        isOnline,
        pendingCount,
        lastSyncTime: lastSyncAt ? new Date(lastSyncAt) : null,
        hasErrors: status === 'blocked',
    };
}

// Hook for triggering sync on app initialization
export function useSyncInit() {
    const { isOnline } = useNetworkStatus();

    useEffect(() => {
        // Update pending counts on init (wrapped in try-catch to prevent crash)
        const initSync = async () => {
            try {
                await syncEngine.updatePendingCounts();
            } catch (e) {
                console.warn('[useSyncInit] Failed to update pending counts:', e);
            }
        };
        initSync();

        // Trigger initial sync if online
        if (isOnline) {
            // Delay initial sync slightly to let app load
            const timeout = setTimeout(() => {
                try {
                    syncEngine.syncAll();
                } catch (e) {
                    console.warn('[useSyncInit] Failed to trigger initial sync:', e);
                }
            }, 2000);

            return () => clearTimeout(timeout);
        }
    }, []);
}
