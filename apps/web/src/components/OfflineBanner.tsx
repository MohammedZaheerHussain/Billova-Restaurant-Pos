// OfflineBanner - Visual indicator for offline status with sync controls
// Step 5 of Phase 1: Bulletproof Offline Engine

import { WifiOff, Wifi, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSyncStore } from '../store/sync-store';
import './OfflineBanner.css';

export interface OfflineBannerProps {
    showSyncButton?: boolean;
    compact?: boolean;
}

export function OfflineBanner({ showSyncButton = true, compact = false }: OfflineBannerProps) {
    const { isOnline, isSlowConnection, triggerSync } = useNetworkStatus();
    const {
        status: syncStatus,
        pendingOrders,
        pendingPayments,
        isSyncing,
        lastSyncAt,
    } = useSyncStore();

    const pendingCount = pendingOrders + pendingPayments;

    // Don't show if online with no pending items
    if (isOnline && pendingCount === 0 && syncStatus !== 'syncing' && !isSlowConnection) {
        return null;
    }

    const getBannerClass = () => {
        if (!isOnline) return 'offline-banner offline-banner--offline';
        if (isSlowConnection) return 'offline-banner offline-banner--slow';
        if (syncStatus === 'blocked') return 'offline-banner offline-banner--error';
        if (syncStatus === 'synced') return 'offline-banner offline-banner--success';
        if (isSyncing) return 'offline-banner offline-banner--syncing';
        if (pendingCount > 0) return 'offline-banner offline-banner--pending';
        return 'offline-banner';
    };

    const getStatusIcon = () => {
        if (!isOnline) return <WifiOff size={compact ? 14 : 16} />;
        if (isSyncing) return <RefreshCw size={compact ? 14 : 16} className="icon-spin" />;
        if (syncStatus === 'blocked') return <AlertTriangle size={compact ? 14 : 16} />;
        if (syncStatus === 'synced') return <CheckCircle size={compact ? 14 : 16} />;
        if (pendingCount > 0) return <RefreshCw size={compact ? 14 : 16} />;
        return <Wifi size={compact ? 14 : 16} />;
    };

    const getStatusText = () => {
        if (!isOnline) {
            return compact
                ? `Offline • ${pendingCount} pending`
                : `You're offline. ${pendingCount} item${pendingCount !== 1 ? 's' : ''} will sync when connected.`;
        }
        if (isSlowConnection) {
            return compact ? 'Slow connection' : 'Slow connection detected. Sync may take longer.';
        }
        if (isSyncing) {
            return compact ? 'Syncing...' : 'Syncing...';
        }
        if (syncStatus === 'blocked') {
            return compact ? 'Sync failed' : 'Sync failed. Tap to retry.';
        }
        if (syncStatus === 'synced') {
            const time = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : '';
            return compact ? `Synced ${time}` : `All synced at ${time}`;
        }
        if (pendingCount > 0) {
            return compact
                ? `${pendingCount} pending`
                : `${pendingCount} item${pendingCount !== 1 ? 's' : ''} pending sync`;
        }
        return 'Connected';
    };

    return (
        <div className={getBannerClass() + (compact ? ' offline-banner--compact' : '')}>
            <div className="offline-banner__content">
                <span className="offline-banner__icon">
                    {getStatusIcon()}
                </span>
                <span className="offline-banner__text">
                    {getStatusText()}
                </span>
            </div>

            {showSyncButton && isOnline && pendingCount > 0 && !isSyncing && (
                <button
                    className="offline-banner__sync-btn"
                    onClick={triggerSync}
                    disabled={isSyncing}
                >
                    <RefreshCw size={14} />
                    {!compact && <span>Sync Now</span>}
                </button>
            )}

            {isSyncing && (
                <div className="offline-banner__progress">
                    <div
                        className="offline-banner__progress-bar"
                        style={{ width: '100%' }}
                    />
                </div>
            )}
        </div>
    );
}

export default OfflineBanner;
