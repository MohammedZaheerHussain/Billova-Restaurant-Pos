// Billova POS - Sync Status Indicator Component
// Shows sync status in navbar/header

import { useSyncStore, getSyncStatusDisplay, getTotalPending } from '../store/sync-store';
import { syncAll } from '../services/sync-service';
import './SyncIndicator.css';

export default function SyncIndicator() {
    const { isSyncing, isOnline, status } = useSyncStore();
    const display = getSyncStatusDisplay();
    const pending = getTotalPending();

    const handleClick = async () => {
        if (isSyncing || status === 'blocked' || !isOnline) return;
        await syncAll();
    };

    return (
        <button
            className={`sync-indicator ${status}`}
            onClick={handleClick}
            disabled={isSyncing || status === 'blocked'}
            title={display.text}
        >
            <span className={`sync-icon ${isSyncing ? 'syncing' : ''}`}>
                {display.icon}
            </span>
            {pending > 0 && status !== 'synced' && (
                <span className="sync-badge">{pending}</span>
            )}
        </button>
    );
}
