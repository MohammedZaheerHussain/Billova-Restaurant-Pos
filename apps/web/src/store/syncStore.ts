// Sync Status Store - Zustand store for sync state management
import { create } from 'zustand';

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'OFFLINE';

export interface SyncState {
    // Status
    status: SyncStatus;
    isOnline: boolean;
    lastSyncTime: Date | null;
    lastSyncError: string | null;

    // Pending counts
    pendingOrders: number;
    pendingPayments: number;
    failedSyncs: number;

    // Sync progress
    currentSyncProgress: number; // 0-100
    currentSyncItem: string | null;

    // Admin flags
    hasAdminFlags: boolean;
    adminFlagCount: number;

    // Actions
    setOnlineStatus: (isOnline: boolean) => void;
    setSyncStatus: (status: SyncStatus) => void;
    updatePendingCounts: (orders: number, payments: number, failed: number) => void;
    setSyncProgress: (progress: number, currentItem: string | null) => void;
    setSyncSuccess: () => void;
    setSyncError: (error: string) => void;
    setAdminFlags: (count: number) => void;
    resetSync: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    // Initial state
    status: 'IDLE',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSyncTime: null,
    lastSyncError: null,

    pendingOrders: 0,
    pendingPayments: 0,
    failedSyncs: 0,

    currentSyncProgress: 0,
    currentSyncItem: null,

    hasAdminFlags: false,
    adminFlagCount: 0,

    // Actions
    setOnlineStatus: (isOnline) => set((state) => ({
        isOnline,
        status: isOnline ? state.status : 'OFFLINE',
    })),

    setSyncStatus: (status) => set({ status }),

    updatePendingCounts: (orders, payments, failed) => set({
        pendingOrders: orders,
        pendingPayments: payments,
        failedSyncs: failed,
    }),

    setSyncProgress: (progress, currentItem) => set({
        currentSyncProgress: progress,
        currentSyncItem: currentItem,
        status: 'SYNCING',
    }),

    setSyncSuccess: () => set({
        status: 'SUCCESS',
        lastSyncTime: new Date(),
        lastSyncError: null,
        currentSyncProgress: 100,
        currentSyncItem: null,
    }),

    setSyncError: (error) => set({
        status: 'ERROR',
        lastSyncError: error,
        currentSyncProgress: 0,
        currentSyncItem: null,
    }),

    setAdminFlags: (count) => set({
        hasAdminFlags: count > 0,
        adminFlagCount: count,
    }),

    resetSync: () => set({
        status: 'IDLE',
        currentSyncProgress: 0,
        currentSyncItem: null,
    }),
}));

// Selector hooks for common patterns
export const usePendingCount = () => useSyncStore((state) =>
    state.pendingOrders + state.pendingPayments
);

export const useIsOffline = () => useSyncStore((state) => !state.isOnline);

export const useHasPendingSync = () => useSyncStore((state) =>
    state.pendingOrders > 0 || state.pendingPayments > 0
);

export const useSyncStatusInfo = () => useSyncStore((state) => ({
    status: state.status,
    isOnline: state.isOnline,
    pendingCount: state.pendingOrders + state.pendingPayments,
    lastSyncTime: state.lastSyncTime,
    hasErrors: state.failedSyncs > 0,
}));
