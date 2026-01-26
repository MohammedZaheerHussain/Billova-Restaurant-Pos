// Sync Engine - Core sync logic for offline-first architecture
import { db, OfflineOrder, SyncLog, generateOrderHash } from '../db/indexed-db';
import { useSyncStore } from '../store/syncStore';
import api from '../api';

// Configuration
const SYNC_CONFIG = {
    MAX_RETRY_ATTEMPTS: 5,
    BASE_RETRY_DELAY_MS: 1000,
    MAX_RETRY_DELAY_MS: 32000,
    ADMIN_FLAG_AFTER_ATTEMPTS: 3,
    BATCH_SIZE: 10,
};

// Sync result types
export interface SyncResult {
    success: boolean;
    localId: string;
    serverId?: string;
    error?: string;
    isDuplicate?: boolean;
}

export interface SyncSummary {
    totalSynced: number;
    totalFailed: number;
    totalSkipped: number;
    errors: string[];
}

// Main Sync Engine Class
class SyncEngine {
    private isSyncing = false;
    private syncAbortController: AbortController | null = null;

    // Calculate exponential backoff delay
    private getRetryDelay(attemptNumber: number): number {
        const delay = Math.min(
            SYNC_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, attemptNumber),
            SYNC_CONFIG.MAX_RETRY_DELAY_MS
        );
        // Add jitter (±10%)
        return delay * (0.9 + Math.random() * 0.2);
    }

    // Check if online
    private isOnline(): boolean {
        return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }

    // Update pending counts in store
    async updatePendingCounts(): Promise<void> {
        const pendingOrders = await db.offlineOrders
            .where('status')
            .anyOf(['CREATED', 'PAID', 'FAILED'])
            .count();

        const pendingPayments = await db.offlinePayments
            .where('status')
            .anyOf(['PENDING', 'FAILED'])
            .count();

        const failedSyncs = await db.syncFailures
            .where('flaggedForAdmin')
            .equals(1)
            .count();

        useSyncStore.getState().updatePendingCounts(
            pendingOrders,
            pendingPayments,
            failedSyncs
        );

        // Update admin flags
        const adminFlags = await db.syncFailures
            .where('flaggedForAdmin')
            .equals(1)
            .filter((f) => !f.resolvedAt)
            .count();

        useSyncStore.getState().setAdminFlags(adminFlags);
    }

    // Log sync attempt
    private async logSyncAttempt(
        entityType: 'ORDER' | 'PAYMENT',
        localId: string,
        action: 'SYNC_ATTEMPT' | 'SYNC_SUCCESS' | 'SYNC_FAILED' | 'FLAGGED_ADMIN',
        attemptNumber: number,
        serverId?: string,
        errorMessage?: string
    ): Promise<void> {
        const log: SyncLog = {
            entityType,
            localId,
            action,
            serverId,
            errorMessage,
            attemptNumber,
            createdAt: new Date(),
        };
        await db.syncLogs.add(log);
    }

    // Flag order for admin review
    private async flagForAdmin(
        entityType: 'ORDER' | 'PAYMENT',
        localId: string,
        errorMessage: string,
        payload: object
    ): Promise<void> {
        await db.syncFailures.add({
            entityType,
            localId,
            errorMessage,
            payload: JSON.stringify(payload),
            attempts: SYNC_CONFIG.ADMIN_FLAG_AFTER_ATTEMPTS,
            flaggedForAdmin: true,
            createdAt: new Date(),
        });

        await this.logSyncAttempt(
            entityType,
            localId,
            'FLAGGED_ADMIN',
            SYNC_CONFIG.ADMIN_FLAG_AFTER_ATTEMPTS,
            undefined,
            errorMessage
        );
    }

    // Sync a single order
    async syncOrder(order: OfflineOrder): Promise<SyncResult> {
        const orderHash = generateOrderHash(order);

        try {
            // Mark as syncing
            await db.offlineOrders.update(order.localId, {
                status: 'SYNCING',
                updatedAt: new Date(),
            });

            // Log attempt
            await this.logSyncAttempt('ORDER', order.localId, 'SYNC_ATTEMPT', order.syncAttempts + 1);

            // Send to server
            const response = await api.post('/orders/offline-sync', {
                localId: order.localId,
                orderHash,
                order: {
                    branchId: order.branchId,
                    tableId: order.tableId,
                    tableName: order.tableName,
                    userId: order.userId,
                    orderType: order.orderType,
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    items: order.items,
                    subtotal: order.subtotal,
                    discountType: order.discountType,
                    discountValue: order.discountValue,
                    discountAmount: order.discountAmount,
                    gstAmount: order.gstAmount,
                    total: order.total,
                    notes: order.notes,
                    tempBillNumber: order.tempBillNumber,
                    createdAt: order.createdAt,
                },
            });

            const result = response.data;

            if (result.success) {
                // Update order with server ID
                await db.offlineOrders.update(order.localId, {
                    status: 'SYNCED',
                    serverId: result.serverId,
                    serverBillNumber: result.billNumber,
                    syncedAt: new Date(),
                    updatedAt: new Date(),
                });

                await this.logSyncAttempt(
                    'ORDER',
                    order.localId,
                    'SYNC_SUCCESS',
                    order.syncAttempts + 1,
                    result.serverId
                );

                return {
                    success: true,
                    localId: order.localId,
                    serverId: result.serverId,
                    isDuplicate: result.isDuplicate,
                };
            }

            throw new Error(result.message || 'Sync failed');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const newAttempts = order.syncAttempts + 1;

            // Update order status
            await db.offlineOrders.update(order.localId, {
                status: 'FAILED',
                syncAttempts: newAttempts,
                lastSyncError: errorMessage,
                updatedAt: new Date(),
            });

            await this.logSyncAttempt(
                'ORDER',
                order.localId,
                'SYNC_FAILED',
                newAttempts,
                undefined,
                errorMessage
            );

            // Flag for admin if too many attempts
            if (newAttempts >= SYNC_CONFIG.ADMIN_FLAG_AFTER_ATTEMPTS) {
                await this.flagForAdmin('ORDER', order.localId, errorMessage, order);
            }

            return {
                success: false,
                localId: order.localId,
                error: errorMessage,
            };
        }
    }

    // Sync all pending orders
    async syncPendingOrders(): Promise<SyncSummary> {
        const summary: SyncSummary = {
            totalSynced: 0,
            totalFailed: 0,
            totalSkipped: 0,
            errors: [],
        };

        // Get pending orders (not already synced or currently syncing)
        const pendingOrders = await db.offlineOrders
            .where('status')
            .anyOf(['CREATED', 'PAID', 'FAILED'])
            .filter((order) => order.syncAttempts < SYNC_CONFIG.MAX_RETRY_ATTEMPTS)
            .toArray();

        const totalOrders = pendingOrders.length;
        let processed = 0;

        for (const order of pendingOrders) {
            if (!this.isOnline()) {
                summary.totalSkipped = totalOrders - processed;
                break;
            }

            // Update progress
            useSyncStore.getState().setSyncProgress(
                Math.round((processed / totalOrders) * 100),
                `Order ${order.tempBillNumber}`
            );

            // Apply retry delay if this is a retry
            if (order.syncAttempts > 0) {
                const delay = this.getRetryDelay(order.syncAttempts);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }

            const result = await this.syncOrder(order);

            if (result.success) {
                summary.totalSynced++;
            } else {
                summary.totalFailed++;
                if (result.error) {
                    summary.errors.push(`Order ${order.tempBillNumber}: ${result.error}`);
                }
            }

            processed++;
        }

        return summary;
    }

    // Main sync function
    async syncAll(): Promise<SyncSummary> {
        if (this.isSyncing) {
            console.log('[SyncEngine] Sync already in progress, skipping...');
            return { totalSynced: 0, totalFailed: 0, totalSkipped: 0, errors: ['Sync already in progress'] };
        }

        if (!this.isOnline()) {
            useSyncStore.getState().setOnlineStatus(false);
            return { totalSynced: 0, totalFailed: 0, totalSkipped: 0, errors: ['Device is offline'] };
        }

        this.isSyncing = true;
        this.syncAbortController = new AbortController();

        const store = useSyncStore.getState();
        store.setSyncStatus('SYNCING');
        store.setSyncProgress(0, 'Starting sync...');

        console.log('[SyncEngine] Starting sync...');

        try {
            // Sync orders
            const ordersSummary = await this.syncPendingOrders();

            // Update pending counts
            await this.updatePendingCounts();

            const totalSynced = ordersSummary.totalSynced;
            const totalFailed = ordersSummary.totalFailed;

            if (totalFailed > 0) {
                store.setSyncError(`${totalFailed} items failed to sync`);
            } else if (totalSynced > 0) {
                store.setSyncSuccess();
            } else {
                store.resetSync();
            }

            console.log(`[SyncEngine] Sync complete: ${totalSynced} synced, ${totalFailed} failed`);

            return ordersSummary;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Sync failed';
            store.setSyncError(errorMessage);
            console.error('[SyncEngine] Sync error:', error);
            return { totalSynced: 0, totalFailed: 0, totalSkipped: 0, errors: [errorMessage] };
        } finally {
            this.isSyncing = false;
            this.syncAbortController = null;
        }
    }

    // Cancel ongoing sync
    cancelSync(): void {
        if (this.syncAbortController) {
            this.syncAbortController.abort();
        }
        this.isSyncing = false;
        useSyncStore.getState().resetSync();
    }

    // Manual sync trigger
    async manualSync(): Promise<SyncSummary> {
        console.log('[SyncEngine] Manual sync triggered');
        return this.syncAll();
    }

    // Get sync statistics
    async getStats(): Promise<{
        pendingOrders: number;
        syncedOrders: number;
        failedOrders: number;
        adminFlags: number;
    }> {
        const [pending, synced, failed, flags] = await Promise.all([
            db.offlineOrders.where('status').anyOf(['CREATED', 'PAID']).count(),
            db.offlineOrders.where('status').equals('SYNCED').count(),
            db.offlineOrders.where('status').equals('FAILED').count(),
            db.syncFailures.where('flaggedForAdmin').equals(1).count(),
        ]);

        return {
            pendingOrders: pending,
            syncedOrders: synced,
            failedOrders: failed,
            adminFlags: flags,
        };
    }
}

// Create singleton instance
export const syncEngine = new SyncEngine();

// Export for use in components
export default syncEngine;
