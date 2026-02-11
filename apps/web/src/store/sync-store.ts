// Billova POS - Cloud Sync Store (Zustand)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'blocked' | 'offline';

interface SyncState {
    // Online status
    isOnline: boolean;

    // Sync state
    status: SyncStatus;
    isSyncing: boolean;

    // Counts
    pendingOrders: number;
    pendingPayments: number;
    pendingKOTs: number;
    pendingStatusUpdates: number;

    // Timestamps
    lastSyncAt: string | null;
    lastSyncError: string | null;

    // Settings
    autoSyncEnabled: boolean;

    // License
    licenseValid: boolean;
    licenseExpiredHard: boolean; // After grace period

    // Actions
    setOnline: (online: boolean) => void;
    setStatus: (status: SyncStatus) => void;
    setSyncing: (syncing: boolean) => void;
    updatePendingCounts: (counts: {
        orders?: number;
        payments?: number;
        kots?: number;
        statusUpdates?: number;
    }) => void;
    setLastSync: (timestamp: string | null, error?: string | null) => void;
    setAutoSync: (enabled: boolean) => void;
    setLicenseStatus: (valid: boolean, expiredHard: boolean) => void;
    reset: () => void;
}

const initialState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    status: 'synced' as SyncStatus,
    isSyncing: false,
    pendingOrders: 0,
    pendingPayments: 0,
    pendingKOTs: 0,
    pendingStatusUpdates: 0,
    lastSyncAt: null,
    lastSyncError: null,
    autoSyncEnabled: true,
    licenseValid: true,
    licenseExpiredHard: false,
};

export const useSyncStore = create<SyncState>()(
    persist(
        (set, get) => ({
            ...initialState,

            setOnline: (online) => {
                set({ isOnline: online });
                // Update status based on online state
                if (!online) {
                    set({ status: 'offline' });
                } else if (get().pendingOrders + get().pendingPayments + get().pendingKOTs > 0) {
                    set({ status: 'pending' });
                } else {
                    set({ status: 'synced' });
                }
            },

            setStatus: (status) => set({ status }),

            setSyncing: (syncing) => {
                set({
                    isSyncing: syncing,
                    status: syncing ? 'syncing' : (get().pendingOrders > 0 ? 'pending' : 'synced')
                });
            },

            updatePendingCounts: ({ orders, payments, kots, statusUpdates }) => {
                const newState: Partial<SyncState> = {};
                if (orders !== undefined) newState.pendingOrders = orders;
                if (payments !== undefined) newState.pendingPayments = payments;
                if (kots !== undefined) newState.pendingKOTs = kots;
                if (statusUpdates !== undefined) newState.pendingStatusUpdates = statusUpdates;

                set(newState);

                // Update status
                const totalPending = (orders ?? get().pendingOrders) +
                    (payments ?? get().pendingPayments) +
                    (kots ?? get().pendingKOTs);

                if (get().licenseExpiredHard) {
                    set({ status: 'blocked' });
                } else if (!get().isOnline) {
                    set({ status: 'offline' });
                } else if (totalPending > 0) {
                    set({ status: 'pending' });
                } else {
                    set({ status: 'synced' });
                }
            },

            setLastSync: (timestamp, error = null) => set({
                lastSyncAt: timestamp,
                lastSyncError: error,
            }),

            setAutoSync: (enabled) => set({ autoSyncEnabled: enabled }),

            setLicenseStatus: (valid, expiredHard) => {
                set({ licenseValid: valid, licenseExpiredHard: expiredHard });
                if (expiredHard) {
                    set({ status: 'blocked' });
                }
            },

            reset: () => set(initialState),
        }),
        {
            name: 'billova-sync',
            partialize: (state) => ({
                autoSyncEnabled: state.autoSyncEnabled,
                lastSyncAt: state.lastSyncAt,
            }),
        }
    )
);

// Helper to get total pending count
export const getTotalPending = () => {
    const state = useSyncStore.getState();
    return state.pendingOrders + state.pendingPayments + state.pendingKOTs + state.pendingStatusUpdates;
};

// Helper to get status display
export const getSyncStatusDisplay = () => {
    const state = useSyncStore.getState();
    const pending = getTotalPending();

    switch (state.status) {
        case 'synced':
            return { icon: '🟢', text: 'All data synced', color: '#22c55e' };
        case 'pending':
            return { icon: '🟡', text: `${pending} pending (tap to sync)`, color: '#eab308' };
        case 'syncing':
            return { icon: '🔄', text: 'Syncing...', color: '#3b82f6' };
        case 'blocked':
            return { icon: '🔴', text: 'Sync blocked (license expired)', color: '#ef4444' };
        case 'offline':
            return { icon: '📴', text: 'Offline - will sync when connected', color: '#6b7280' };
        default:
            return { icon: '⚪', text: 'Unknown', color: '#9ca3af' };
    }
};
