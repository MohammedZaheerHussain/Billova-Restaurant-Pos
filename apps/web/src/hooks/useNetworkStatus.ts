// Network Status Hook - Detects online/offline state
import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
    isOnline: boolean;
    wasOffline: boolean;  // True if we just came back online
    connectionType: string | undefined;
    effectiveType: string | undefined; // 4g, 3g, 2g, slow-2g
}

// Extended Navigator type for connection API
interface NavigatorWithConnection extends Navigator {
    connection?: {
        type?: string;
        effectiveType?: string;
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
    };
}

export function useNetworkStatus(): NetworkStatus {
    const [status, setStatus] = useState<NetworkStatus>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        wasOffline: false,
        connectionType: undefined,
        effectiveType: undefined,
    });

    const getConnectionInfo = useCallback(() => {
        const nav = navigator as NavigatorWithConnection;
        if (nav.connection) {
            return {
                connectionType: nav.connection.type,
                effectiveType: nav.connection.effectiveType,
            };
        }
        return { connectionType: undefined, effectiveType: undefined };
    }, []);

    const handleOnline = useCallback(() => {
        const connInfo = getConnectionInfo();
        setStatus((prev) => ({
            isOnline: true,
            wasOffline: !prev.isOnline, // Was offline before this event
            ...connInfo,
        }));
    }, [getConnectionInfo]);

    const handleOffline = useCallback(() => {
        const connInfo = getConnectionInfo();
        setStatus({
            isOnline: false,
            wasOffline: false,
            ...connInfo,
        });
    }, [getConnectionInfo]);

    const handleConnectionChange = useCallback(() => {
        const connInfo = getConnectionInfo();
        setStatus((prev) => ({
            ...prev,
            ...connInfo,
        }));
    }, [getConnectionInfo]);

    useEffect(() => {
        // Set initial state
        const connInfo = getConnectionInfo();
        setStatus({
            isOnline: navigator.onLine,
            wasOffline: false,
            ...connInfo,
        });

        // Listen for online/offline events
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Listen for connection changes
        const nav = navigator as NavigatorWithConnection;
        if (nav.connection) {
            nav.connection.addEventListener('change', handleConnectionChange);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (nav.connection) {
                nav.connection.removeEventListener('change', handleConnectionChange);
            }
        };
    }, [handleOnline, handleOffline, handleConnectionChange, getConnectionInfo]);

    return status;
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
