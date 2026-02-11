// Network Status Hook - Detects online/offline state and triggers sync
import { useState, useEffect, useCallback } from 'react';
import { useSyncStore } from '../store/sync-store';
import { logger } from '../utils/logger';

export interface NetworkStatus {
    isOnline: boolean;
    wasOffline: boolean;  // True if we just came back online
    connectionType: string | undefined;
    effectiveType: string | undefined; // 4g, 3g, 2g, slow-2g
    isSlowConnection: boolean;
}

// Extended Navigator type for connection API
interface NavigatorWithConnection extends Navigator {
    connection?: {
        type?: string;
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
    };
}

export function useNetworkStatus(): NetworkStatus & { triggerSync: () => void } {
    // Extract setOnline directly - this gives a stable reference that won't cause re-renders
    const setOnline = useSyncStore((state) => state.setOnline);

    const [status, setStatus] = useState<NetworkStatus>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        wasOffline: false,
        connectionType: undefined,
        effectiveType: undefined,
        isSlowConnection: false,
    });

    const getConnectionInfo = useCallback((): { connectionType: string | undefined; effectiveType: string | undefined; isSlowConnection: boolean } => {
        const nav = navigator as NavigatorWithConnection;
        if (nav.connection) {
            const isSlow = Boolean(
                nav.connection.effectiveType === '2g' ||
                nav.connection.effectiveType === 'slow-2g' ||
                (nav.connection.rtt && nav.connection.rtt > 500) ||
                (nav.connection.downlink && nav.connection.downlink < 0.5)
            );

            return {
                connectionType: nav.connection.type,
                effectiveType: nav.connection.effectiveType,
                isSlowConnection: isSlow,
            };
        }
        return { connectionType: undefined, effectiveType: undefined, isSlowConnection: false };
    }, []);

    const handleOnline = useCallback(async () => {
        const connInfo = getConnectionInfo();
        setStatus((prev) => ({
            isOnline: true,
            wasOffline: !prev.isOnline, // Was offline before this event
            ...connInfo,
        }));
        setOnline(true);

        logger.debug('[Network] Online - triggering sync');

        // Dynamic import to avoid circular dependency
        const { syncQueue } = await import('../sync/sync-queue');
        syncQueue.processQueue();
    }, [getConnectionInfo, setOnline]);

    const handleOffline = useCallback(() => {
        const connInfo = getConnectionInfo();
        setStatus({
            isOnline: false,
            wasOffline: false,
            ...connInfo,
        });
        setOnline(false);
        logger.debug('[Network] Offline');
    }, [getConnectionInfo, setOnline]);

    const handleConnectionChange = useCallback(() => {
        const connInfo = getConnectionInfo();
        setStatus((prev) => ({
            ...prev,
            ...connInfo,
        }));
    }, [getConnectionInfo]);

    const triggerSync = useCallback(async () => {
        if (status.isOnline) {
            logger.debug('[Network] Manual sync triggered');
            const { syncQueue } = await import('../sync/sync-queue');
            syncQueue.manualSync();
        } else {
            logger.debug('[Network] Cannot sync - offline');
        }
    }, [status.isOnline]);

    useEffect(() => {
        // Set initial state
        const connInfo = getConnectionInfo();
        const initialOnline = navigator.onLine;
        setStatus({
            isOnline: initialOnline,
            wasOffline: false,
            ...connInfo,
        });
        setOnline(initialOnline);

        // Listen for online/offline events
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Listen for visibility changes (Layer 2 - app focus)
        const handleVisibility = async () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                logger.debug('[Network] App focused - checking sync');
                const { syncQueue } = await import('../sync/sync-queue');
                syncQueue.processQueue();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // Listen for connection changes
        const nav = navigator as NavigatorWithConnection;
        if (nav.connection) {
            nav.connection.addEventListener('change', handleConnectionChange);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (nav.connection) {
                nav.connection.removeEventListener('change', handleConnectionChange);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleOnline, handleOffline, handleConnectionChange, getConnectionInfo]); // syncStore excluded - stable

    return { ...status, triggerSync };
}

// Hook to run a callback when coming back online
export function useOnReconnect(callback: () => void): void {
    const { wasOffline, isOnline } = useNetworkStatus();

    useEffect(() => {
        if (wasOffline && isOnline) {
            callback();
        }
    }, [wasOffline, isOnline, callback]);
}

