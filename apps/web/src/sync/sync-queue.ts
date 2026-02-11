// Sync Queue - Robust offline-first sync with retry, priority, and batch processing
// Step 3 of Phase 1: Bulletproof Offline Engine

import { db, OfflineOrder, OfflinePayment, OfflineKOT } from '../db/indexed-db';
import { useSyncStore } from '../store/sync-store';
import { writeJournal, markSynced } from './transaction-journal';
import api from '../api';

// ==================== CONFIGURATION ====================

const QUEUE_CONFIG = {
    // Retry settings
    MAX_RETRIES: 10,
    BASE_DELAY_MS: 1000,           // 1 second
    MAX_DELAY_MS: 60000,           // 1 minute max
    JITTER_FACTOR: 0.2,            // ±20% random jitter

    // Batch settings
    BATCH_SIZE: 20,                // Items per batch
    BATCH_DELAY_MS: 100,           // Delay between items in batch

    // Priority (lower = higher priority)
    PRIORITY: {
        PAYMENT: 1,                // Money-related = highest
        ORDER: 2,
        KOT: 3,
        STOCK: 4,
        OTHER: 5,
    },

    // Thresholds
    ADMIN_FLAG_AFTER: 5,           // Flag for admin after N failures
    STALE_AFTER_HOURS: 48,         // Consider stale after N hours
};

// ==================== TYPES ====================

export interface SyncQueueItem {
    id: string;
    entityType: 'ORDER' | 'PAYMENT' | 'KOT' | 'STOCK' | 'CUSTOMER';
    entityId: string;
    priority: number;
    attempts: number;
    lastAttempt?: number;
    nextRetry?: number;
    error?: string;
    payload: any;
    journalId?: string;
}

export interface SyncBatchResult {
    total: number;
    synced: number;
    failed: number;
    skipped: number;
    errors: string[];
}

export interface SyncQueueStats {
    pending: number;
    failed: number;
    inProgress: number;
    byPriority: { priority: number; count: number }[];
}

// ==================== SYNC QUEUE CLASS ====================

class SyncQueue {
    private isProcessing = false;
    private abortController: AbortController | null = null;
    private networkListenerAttached = false;

    // ==================== NETWORK STATUS ====================

    /**
     * Check if device is online
     */
    isOnline(): boolean {
        return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }

    /**
     * Attach network listeners for auto-sync
     */
    attachNetworkListeners(): void {
        if (this.networkListenerAttached || typeof window === 'undefined') return;

        // Layer 1: Online event
        window.addEventListener('online', () => {
            console.log('[SyncQueue] Network online - triggering sync');
            useSyncStore.getState().setOnline(true);
            this.processQueue();
        });

        window.addEventListener('offline', () => {
            console.log('[SyncQueue] Network offline');
            useSyncStore.getState().setOnline(false);
        });

        // Layer 2: App focus event
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isOnline()) {
                console.log('[SyncQueue] App focused - checking for pending sync');
                this.processQueue();
            }
        });

        this.networkListenerAttached = true;
        console.log('[SyncQueue] Network listeners attached (3-layer sync)');
    }

    // ==================== RETRY LOGIC ====================

    /**
     * Calculate exponential backoff delay with jitter
     */
    private getRetryDelay(attemptNumber: number): number {
        const exponential = Math.min(
            QUEUE_CONFIG.BASE_DELAY_MS * Math.pow(2, attemptNumber),
            QUEUE_CONFIG.MAX_DELAY_MS
        );

        // Add jitter (±20%)
        const jitter = 1 + (Math.random() * 2 - 1) * QUEUE_CONFIG.JITTER_FACTOR;
        return Math.round(exponential * jitter);
    }

    /**
     * Check if item is ready for retry
     */
    private isReadyForRetry(item: { lastAttempt?: number; attempts: number }): boolean {
        if (!item.lastAttempt) return true;

        const delay = this.getRetryDelay(item.attempts);
        const nextRetry = item.lastAttempt + delay;
        return Date.now() >= nextRetry;
    }

    // ==================== QUEUE BUILDING ====================

    /**
     * Get all items ready for sync, ordered by priority
     */
    async getQueueItems(): Promise<SyncQueueItem[]> {
        const items: SyncQueueItem[] = [];

        // Get pending orders
        const orders = await db.offlineOrders
            .where('status')
            .anyOf(['CREATED', 'PAID', 'FAILED'])
            .filter(o => o.syncAttempts < QUEUE_CONFIG.MAX_RETRIES)
            .toArray();

        for (const order of orders) {
            if (this.isReadyForRetry({ lastAttempt: order.updatedAt?.getTime(), attempts: order.syncAttempts })) {
                items.push({
                    id: `order-${order.localId}`,
                    entityType: 'ORDER',
                    entityId: order.localId,
                    priority: order.items.some(i => i.total > 0) ? QUEUE_CONFIG.PRIORITY.ORDER : QUEUE_CONFIG.PRIORITY.OTHER,
                    attempts: order.syncAttempts,
                    payload: order,
                });
            }
        }

        // Get pending payments
        const payments = await db.offlinePayments
            .where('status')
            .anyOf(['PENDING', 'FAILED'])
            .toArray();

        for (const payment of payments) {
            items.push({
                id: `payment-${payment.localId}`,
                entityType: 'PAYMENT',
                entityId: payment.localId,
                priority: QUEUE_CONFIG.PRIORITY.PAYMENT, // Highest priority
                attempts: 0,
                payload: payment,
            });
        }

        // Get pending KOTs
        const kots = await db.offlineKOTs
            .where('syncStatus')
            .anyOf(['PENDING', 'FAILED'])
            .toArray();

        for (const kot of kots) {
            items.push({
                id: `kot-${kot.localId}`,
                entityType: 'KOT',
                entityId: kot.localId,
                priority: QUEUE_CONFIG.PRIORITY.KOT,
                attempts: 0,
                payload: kot,
            });
        }

        // Sort by priority (lower number = higher priority)
        return items.sort((a, b) => a.priority - b.priority);
    }

    // ==================== SYNC OPERATIONS ====================

    /**
     * Sync a single order
     */
    async syncOrder(order: OfflineOrder): Promise<{ success: boolean; serverId?: string; error?: string }> {
        try {
            // Log to journal BEFORE operation
            const journalId = await writeJournal(
                'CREATE_ORDER',
                'order',
                order.localId,
                { total: order.total, items: order.items.length },
                order.branchId,
                order.userId
            );

            // Mark as syncing
            await db.offlineOrders.update(order.localId, {
                status: 'SYNCING',
                updatedAt: new Date(),
            });

            // Send to server
            const response = await api.post('/orders/offline-sync', {
                localId: order.localId,
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

            if (response.data.success) {
                // Mark order as synced
                await db.offlineOrders.update(order.localId, {
                    status: 'SYNCED',
                    serverId: response.data.serverId,
                    serverBillNumber: response.data.billNumber,
                    syncedAt: new Date(),
                    updatedAt: new Date(),
                });

                // Mark journal entry as synced
                await markSynced(journalId, Date.now());

                return { success: true, serverId: response.data.serverId };
            }

            throw new Error(response.data.message || 'Sync failed');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Update order with failure
            await db.offlineOrders.update(order.localId, {
                status: 'FAILED',
                syncAttempts: order.syncAttempts + 1,
                lastSyncError: errorMessage,
                updatedAt: new Date(),
            });

            return { success: false, error: errorMessage };
        }
    }

    /**
     * Sync a single payment
     */
    async syncPayment(payment: OfflinePayment): Promise<{ success: boolean; error?: string }> {
        try {
            // Get the related order first
            const order = await db.offlineOrders.get(payment.orderLocalId);
            if (!order || order.status !== 'SYNCED') {
                // Can't sync payment until order is synced
                return { success: false, error: 'Order not yet synced' };
            }

            const response = await api.post('/payments', {
                orderId: order.serverId,
                mode: payment.mode,
                amount: payment.amount,
                reference: payment.reference,
            });

            if (response.data.success) {
                await db.offlinePayments.update(payment.localId, {
                    status: 'SYNCED',
                    serverId: response.data.id,
                });
                return { success: true };
            }

            throw new Error(response.data.message || 'Payment sync failed');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await db.offlinePayments.update(payment.localId, {
                status: 'FAILED',
            });
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Sync a single KOT
     */
    async syncKOT(kot: OfflineKOT): Promise<{ success: boolean; error?: string }> {
        try {
            const order = await db.offlineOrders.get(kot.orderLocalId);
            if (!order || order.status !== 'SYNCED') {
                return { success: false, error: 'Order not yet synced' };
            }

            const response = await api.post('/kots', {
                orderId: order.serverId,
                branchId: kot.branchId,
                kotNumber: kot.kotNumber,
                items: kot.items,
                status: kot.status,
            });

            if (response.data.success) {
                await db.offlineKOTs.update(kot.localId, {
                    syncStatus: 'SYNCED',
                    serverId: response.data.id,
                    syncedAt: new Date(),
                });
                return { success: true };
            }

            throw new Error(response.data.message || 'KOT sync failed');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await db.offlineKOTs.update(kot.localId, {
                syncStatus: 'FAILED',
            });
            return { success: false, error: errorMessage };
        }
    }

    // ==================== QUEUE PROCESSING ====================

    /**
     * Process a single queue item
     */
    async processItem(item: SyncQueueItem): Promise<{ success: boolean; error?: string }> {
        switch (item.entityType) {
            case 'ORDER':
                return this.syncOrder(item.payload as OfflineOrder);
            case 'PAYMENT':
                return this.syncPayment(item.payload as OfflinePayment);
            case 'KOT':
                return this.syncKOT(item.payload as OfflineKOT);
            default:
                return { success: false, error: `Unknown entity type: ${item.entityType}` };
        }
    }

    /**
     * Process the entire queue
     */
    async processQueue(): Promise<SyncBatchResult> {
        if (this.isProcessing) {
            console.log('[SyncQueue] Already processing, skipping...');
            return { total: 0, synced: 0, failed: 0, skipped: 0, errors: ['Already processing'] };
        }

        if (!this.isOnline()) {
            console.log('[SyncQueue] Offline, skipping...');
            useSyncStore.getState().setOnline(false);
            return { total: 0, synced: 0, failed: 0, skipped: 0, errors: ['Offline'] };
        }

        this.isProcessing = true;
        this.abortController = new AbortController();

        const store = useSyncStore.getState();
        store.setSyncing(true);

        const result: SyncBatchResult = { total: 0, synced: 0, failed: 0, skipped: 0, errors: [] };

        try {
            const items = await this.getQueueItems();
            result.total = items.length;

            console.log(`[SyncQueue] Processing ${items.length} items...`);

            for (let i = 0; i < items.length; i++) {
                // Check for abort
                if (this.abortController.signal.aborted) {
                    result.skipped = items.length - i;
                    break;
                }

                // Check if still online
                if (!this.isOnline()) {
                    result.skipped = items.length - i;
                    store.setOnline(false);
                    break;
                }

                const item = items[i];

                // Log progress instead of updating store (sync-store doesn't have setSyncProgress)
                const progress = Math.round(((i + 1) / items.length) * 100);
                console.log(`[SyncQueue] Progress: ${progress}% - ${item.entityType} ${item.entityId.substring(0, 8)}...`);

                // Process item
                const { success, error } = await this.processItem(item);

                if (success) {
                    result.synced++;
                } else {
                    result.failed++;
                    if (error) result.errors.push(`${item.entityType}: ${error}`);
                }

                // Small delay between items to prevent overwhelming server
                if (i < items.length - 1) {
                    await new Promise(r => setTimeout(r, QUEUE_CONFIG.BATCH_DELAY_MS));
                }
            }

            // Update final status
            if (result.failed > 0) {
                store.setLastSync(new Date().toISOString(), `${result.failed} items failed`);
            } else if (result.synced > 0) {
                store.setLastSync(new Date().toISOString(), null);
            } else {
                store.setSyncing(false);
            }

            console.log(`[SyncQueue] Complete: ${result.synced} synced, ${result.failed} failed, ${result.skipped} skipped`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Queue processing failed';
            store.setLastSync(new Date().toISOString(), errorMessage);
            result.errors.push(errorMessage);
            console.error('[SyncQueue] Error:', error);
        } finally {
            this.isProcessing = false;
            this.abortController = null;
            await this.updatePendingCounts();
        }

        return result;
    }

    /**
     * Manual sync trigger (Layer 3)
     */
    async manualSync(): Promise<SyncBatchResult> {
        console.log('[SyncQueue] Manual sync triggered');
        return this.processQueue();
    }

    /**
     * Cancel ongoing sync
     */
    cancelSync(): void {
        if (this.abortController) {
            this.abortController.abort();
            console.log('[SyncQueue] Sync cancelled');
        }
        this.isProcessing = false;
        useSyncStore.getState().reset();
    }

    // ==================== STATS & MONITORING ====================

    /**
     * Update pending counts in store
     */
    async updatePendingCounts(): Promise<void> {
        const [pendingOrders, pendingPayments] = await Promise.all([
            db.offlineOrders.where('status').anyOf(['CREATED', 'PAID', 'FAILED']).count(),
            db.offlinePayments.where('status').anyOf(['PENDING', 'FAILED']).count(),
        ]);

        useSyncStore.getState().updatePendingCounts({ orders: pendingOrders, payments: pendingPayments });
    }

    /**
     * Get queue statistics
     */
    async getStats(): Promise<SyncQueueStats> {
        const items = await this.getQueueItems();

        const byPriority = [1, 2, 3, 4, 5].map(priority => ({
            priority,
            count: items.filter(i => i.priority === priority).length,
        }));

        const failedOrders = await db.offlineOrders.where('status').equals('FAILED').count();
        const failedPayments = await db.offlinePayments.where('status').equals('FAILED').count();

        return {
            pending: items.length,
            failed: failedOrders + failedPayments,
            inProgress: this.isProcessing ? 1 : 0,
            byPriority,
        };
    }

    /**
     * Check if queue is empty
     */
    async isEmpty(): Promise<boolean> {
        const items = await this.getQueueItems();
        return items.length === 0;
    }
}

// ==================== SINGLETON & EXPORTS ====================

export const syncQueue = new SyncQueue();

// Initialize network listeners on module load
if (typeof window !== 'undefined') {
    syncQueue.attachNetworkListeners();
}

export default syncQueue;
