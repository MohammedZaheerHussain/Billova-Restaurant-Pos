// useSync Hook - Hook for managing sync operations
import { useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useSyncStore, useSyncStatusInfo } from '../store/syncStore';
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
    const syncInfo = useSyncStatusInfo();
    const { setOnlineStatus } = useSyncStore();
    const intervalRef = useRef<number | null>(null);

    // Update online status in store
    useEffect(() => {
        setOnlineStatus(isOnline);
    }, [isOnline, setOnlineStatus]);

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
        syncEngine.updatePendingCounts();
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

    return {
        ...syncInfo,
        isOnline,
        triggerSync,
        cancelSync,
        updatePendingCounts: syncEngine.updatePendingCounts.bind(syncEngine),
    };
}

// Simple hook for just the sync status badge
export function useSyncStatus() {
    const syncInfo = useSyncStatusInfo();
    const { isOnline } = useNetworkStatus();

    return {
        ...syncInfo,
        isOnline,
    };
}

// Hook for triggering sync on app initialization
export function useSyncInit() {
    const { isOnline } = useNetworkStatus();

    useEffect(() => {
        // Update pending counts on init
        syncEngine.updatePendingCounts();

        // Trigger initial sync if online
        if (isOnline) {
            // Delay initial sync slightly to let app load
            const timeout = setTimeout(() => {
                syncEngine.syncAll();
            }, 2000);

            return () => clearTimeout(timeout);
        }
    }, []);
}
