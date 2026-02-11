// Billova POS - Cloud Sync Service
// Handles offline → online sync with idempotency, batching, and license validation

import { db } from '../db/indexed-db';
import { useSyncStore } from '../store/sync-store';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

// ==================== CONSTANTS ====================

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 3000, 10000];

type SyncEntityType = 'ORDER' | 'PAYMENT' | 'KOT' | 'ORDER_STATUS' | 'CANCELLED_ITEM';

// ==================== ONLINE/OFFLINE DETECTION ====================

let isInitialized = false;

export function initSyncService() {
    if (isInitialized) return;
    isInitialized = true;

    // Set initial state
    useSyncStore.getState().setOnline(navigator.onLine);

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    if (navigator.onLine) {
        updatePendingCounts();
    }

    logger.debug('✅ Sync Service initialized');
}

function handleOnline() {
    logger.debug('🌐 Network: Online');
    useSyncStore.getState().setOnline(true);

    // Auto-sync if enabled
    const { autoSyncEnabled } = useSyncStore.getState();
    if (autoSyncEnabled) {
        syncAll();
    } else {
        updatePendingCounts();
    }
}

function handleOffline() {
    logger.debug('📴 Network: Offline');
    useSyncStore.getState().setOnline(false);
}

// ==================== PENDING COUNTS ====================

export async function updatePendingCounts() {
    try {
        const [orders, payments, kots, statusHistory, cancelled] = await Promise.all([
            db.offlineOrders.where('status').anyOf(['CREATED', 'PAID', 'FAILED']).count(),
            db.offlinePayments.where('status').anyOf(['PENDING', 'FAILED']).count(),
            db.offlineKOTs?.where('syncStatus').anyOf(['PENDING', 'FAILED']).count() || 0,
            db.orderStatusHistory?.where('syncStatus').anyOf(['PENDING', 'FAILED']).count() || 0,
            db.cancelledItems?.where('syncStatus').anyOf(['PENDING', 'FAILED']).count() || 0,
        ]);

        useSyncStore.getState().updatePendingCounts({
            orders,
            payments,
            kots,
            statusUpdates: statusHistory + cancelled,
        });
    } catch (error) {
        logger.error('Failed to update pending counts:', error);
    }
}

// ==================== LICENSE VALIDATION ====================

async function validateLicense(): Promise<{ valid: boolean; inGrace: boolean; expiredHard: boolean }> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { valid: false, inGrace: false, expiredHard: true };

        // Get user's branch license
        const { data: profile } = await supabase
            .from('profiles')
            .select('branch_id')
            .eq('id', user.id)
            .single();

        if (!profile?.branch_id) {
            // Super admin or no branch - allow sync
            return { valid: true, inGrace: false, expiredHard: false };
        }

        const { data: license } = await supabase
            .from('licenses')
            .select('*')
            .eq('branch_id', profile.branch_id)
            .single();

        if (!license) return { valid: false, inGrace: false, expiredHard: true };

        const now = new Date();
        const expiresAt = new Date(license.expires_at);
        const gracePeriodDays = 7;
        const graceEndDate = new Date(expiresAt);
        graceEndDate.setDate(graceEndDate.getDate() + gracePeriodDays);

        if (license.status === 'ACTIVE' && now < expiresAt) {
            return { valid: true, inGrace: false, expiredHard: false };
        } else if (now < graceEndDate) {
            return { valid: true, inGrace: true, expiredHard: false };
        } else {
            return { valid: false, inGrace: false, expiredHard: true };
        }
    } catch (error) {
        logger.error('License validation error:', error);
        // Allow sync on error (fail-open for UX)
        return { valid: true, inGrace: false, expiredHard: false };
    }
}

// ==================== IDEMPOTENCY CHECK ====================

async function checkIdempotency(idempotencyKey: string): Promise<{ exists: boolean; record?: any }> {
    try {
        const { data, error } = await supabase
            .from('sync_events')
            .select('*')
            .eq('idempotency_key', idempotencyKey)
            .eq('status', 'success')
            .single();

        if (data && !error) {
            return { exists: true, record: data };
        }
        return { exists: false };
    } catch {
        return { exists: false };
    }
}

async function recordSyncEvent(
    branchId: string,
    entityType: SyncEntityType,
    localId: string,
    status: 'pending' | 'success' | 'failed',
    entityId?: string,
    error?: string
) {
    try {
        const idempotencyKey = `${entityType}:${localId}`;

        // Try to update existing or insert new
        const { data: existing } = await supabase
            .from('sync_events')
            .select('id, attempt_count')
            .eq('idempotency_key', idempotencyKey)
            .single();

        if (existing) {
            await supabase
                .from('sync_events')
                .update({
                    status,
                    entity_id: entityId,
                    error,
                    attempt_count: existing.attempt_count + 1,
                    processed_at: status !== 'pending' ? new Date().toISOString() : null,
                })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('sync_events')
                .insert({
                    branch_id: branchId,
                    entity_type: entityType,
                    local_id: localId,
                    idempotency_key: idempotencyKey,
                    entity_id: entityId,
                    status,
                    attempt_count: 1,
                    error,
                    processed_at: status !== 'pending' ? new Date().toISOString() : null,
                });
        }
    } catch (e) {
        logger.error('Failed to record sync event:', e);
    }
}

// ==================== SYNC ALL ====================

export async function syncAll(): Promise<{ success: boolean; synced: number; failed: number }> {
    const syncStore = useSyncStore.getState();

    if (syncStore.isSyncing) {
        logger.debug('⏳ Sync already in progress');
        return { success: false, synced: 0, failed: 0 };
    }

    if (!navigator.onLine) {
        logger.debug('📴 Cannot sync - offline');
        return { success: false, synced: 0, failed: 0 };
    }

    // Validate license
    const license = await validateLicense();
    syncStore.setLicenseStatus(license.valid, license.expiredHard);

    if (license.expiredHard) {
        logger.debug('🔴 Sync blocked - license expired');
        toast.error('Sync blocked: License expired. Please renew to sync data.');
        return { success: false, synced: 0, failed: 0 };
    }

    if (license.inGrace) {
        toast('⚠️ License expiring soon. Please renew.', { icon: '⚠️' });
    }

    // Start syncing
    syncStore.setSyncing(true);
    let totalSynced = 0;
    let totalFailed = 0;

    try {
        // Sync in order: Orders → Payments → KOTs → Status → Cancelled
        const orderResult = await syncPendingOrders();
        totalSynced += orderResult.synced;
        totalFailed += orderResult.failed;

        const paymentResult = await syncPendingPayments();
        totalSynced += paymentResult.synced;
        totalFailed += paymentResult.failed;

        const kotResult = await syncPendingKOTs();
        totalSynced += kotResult.synced;
        totalFailed += kotResult.failed;

        const statusResult = await syncOrderStatusUpdates();
        totalSynced += statusResult.synced;
        totalFailed += statusResult.failed;

        const cancelledResult = await syncCancelledItems();
        totalSynced += cancelledResult.synced;
        totalFailed += cancelledResult.failed;

        // Update timestamp
        syncStore.setLastSync(
            new Date().toISOString(),
            totalFailed > 0 ? `${totalFailed} items failed to sync` : null
        );

        if (totalSynced > 0) {
            toast.success(`✅ Synced ${totalSynced} items to cloud`);
        }

        return { success: true, synced: totalSynced, failed: totalFailed };
    } catch (error) {
        logger.error('Sync error:', error);
        syncStore.setLastSync(new Date().toISOString(), String(error));
        return { success: false, synced: totalSynced, failed: totalFailed };
    } finally {
        syncStore.setSyncing(false);
        await updatePendingCounts();
    }
}

// ==================== SYNC ORDERS ====================

async function syncPendingOrders(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    const pendingOrders = await db.offlineOrders
        .where('status')
        .anyOf(['CREATED', 'PAID', 'FAILED'])
        .limit(BATCH_SIZE)
        .toArray();

    for (const order of pendingOrders) {
        const idempotencyKey = `ORDER:${order.localId}`;

        // Check if already synced
        const { exists, record } = await checkIdempotency(idempotencyKey);
        if (exists) {
            // Mark as synced locally
            await db.offlineOrders.update(order.localId, {
                status: 'SYNCED',
                serverId: record?.entity_id,
                syncedAt: new Date(),
            });
            synced++;
            continue;
        }

        try {
            // Record attempt
            await recordSyncEvent(order.branchId, 'ORDER', order.localId, 'pending');

            // Transform and send to API
            const response = await fetch('/api/orders/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotency_key: idempotencyKey,
                    local_id: order.localId,
                    branch_id: order.branchId,
                    table_id: order.tableId,
                    order_type: order.orderType,
                    customer_name: order.customerName,
                    customer_phone: order.customerPhone,
                    items: order.items,
                    subtotal: order.subtotal,
                    discount_type: order.discountType,
                    discount_value: order.discountValue,
                    discount_amount: order.discountAmount,
                    gst_amount: order.gstAmount,
                    total: order.total,
                    notes: order.notes,
                    created_at: order.createdAt.toISOString(),
                }),
            });

            if (response.ok) {
                const data = await response.json();
                await db.offlineOrders.update(order.localId, {
                    status: 'SYNCED',
                    serverId: data.id,
                    serverBillNumber: data.bill_number,
                    syncedAt: new Date(),
                });
                await recordSyncEvent(order.branchId, 'ORDER', order.localId, 'success', data.id);
                synced++;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            failed++;
            order.syncAttempts++;
            order.lastSyncError = String(error);

            if (order.syncAttempts >= MAX_RETRIES) {
                order.status = 'FAILED';
                await recordSyncEvent(order.branchId, 'ORDER', order.localId, 'failed', undefined, String(error));
            }
            await db.offlineOrders.put(order);
        }
    }

    return { synced, failed };
}

// ==================== SYNC PAYMENTS ====================

async function syncPendingPayments(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    const pendingPayments = await db.offlinePayments
        .where('status')
        .anyOf(['PENDING', 'FAILED'])
        .limit(BATCH_SIZE)
        .toArray();

    for (const payment of pendingPayments) {
        const idempotencyKey = `PAYMENT:${payment.localId}`;

        const { exists } = await checkIdempotency(idempotencyKey);
        if (exists) {
            await db.offlinePayments.update(payment.localId, { status: 'SYNCED' });
            synced++;
            continue;
        }

        try {
            // Get the server order ID
            const order = await db.offlineOrders.get(payment.orderLocalId);
            if (!order?.serverId) {
                // Order not synced yet, skip payment
                continue;
            }

            const response = await fetch('/api/orders/sync-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotency_key: idempotencyKey,
                    order_id: order.serverId,
                    mode: payment.mode,
                    amount: payment.amount,
                    reference: payment.reference,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                await db.offlinePayments.update(payment.localId, {
                    status: 'SYNCED',
                    serverId: data.id,
                });
                synced++;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            failed++;
            await db.offlinePayments.update(payment.localId, { status: 'FAILED' });
        }
    }

    return { synced, failed };
}

// ==================== SYNC KOTs ====================

async function syncPendingKOTs(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    if (!db.offlineKOTs) return { synced, failed };

    const pendingKOTs = await db.offlineKOTs
        .where('syncStatus')
        .anyOf(['PENDING', 'FAILED'])
        .limit(BATCH_SIZE)
        .toArray();

    for (const kot of pendingKOTs) {
        const idempotencyKey = `KOT:${kot.localId}`;

        const { exists } = await checkIdempotency(idempotencyKey);
        if (exists) {
            await db.offlineKOTs.update(kot.localId, { syncStatus: 'SYNCED', syncedAt: new Date() });
            synced++;
            continue;
        }

        try {
            const order = await db.offlineOrders.get(kot.orderLocalId);
            if (!order?.serverId) continue;

            const response = await fetch('/api/orders/sync-kot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotency_key: idempotencyKey,
                    order_id: order.serverId,
                    kot_number: kot.kotNumber,
                    items: kot.items,
                    status: kot.status,
                }),
            });

            if (response.ok) {
                await db.offlineKOTs.update(kot.localId, { syncStatus: 'SYNCED', syncedAt: new Date() });
                synced++;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch {
            failed++;
            await db.offlineKOTs.update(kot.localId, { syncStatus: 'FAILED' });
        }
    }

    return { synced, failed };
}

// ==================== SYNC ORDER STATUS ====================

async function syncOrderStatusUpdates(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    if (!db.orderStatusHistory) return { synced, failed };

    const pendingUpdates = await db.orderStatusHistory
        .where('syncStatus')
        .anyOf(['PENDING', 'FAILED'])
        .limit(BATCH_SIZE)
        .toArray();

    for (const update of pendingUpdates) {
        try {
            const order = await db.offlineOrders.get(update.orderLocalId);
            if (!order?.serverId) continue;

            // Order status is server-authoritative - we send intent only
            const response = await fetch('/api/orders/status-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: order.serverId,
                    intended_status: update.newStatus,
                    changed_by: update.changedBy,
                    changed_at: update.changedAt.toISOString(),
                }),
            });

            if (response.ok) {
                await db.orderStatusHistory.update(update.id!, { syncStatus: 'SYNCED', syncedAt: new Date() });
                synced++;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch {
            failed++;
            await db.orderStatusHistory.update(update.id!, { syncStatus: 'FAILED' });
        }
    }

    return { synced, failed };
}

// ==================== SYNC CANCELLED ITEMS ====================

async function syncCancelledItems(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    if (!db.cancelledItems) return { synced, failed };

    const pendingCancellations = await db.cancelledItems
        .where('syncStatus')
        .anyOf(['PENDING', 'FAILED'])
        .limit(BATCH_SIZE)
        .toArray();

    for (const item of pendingCancellations) {
        const idempotencyKey = `CANCELLED:${item.orderLocalId}:${item.menuItemId}:${item.cancelledAt.getTime()}`;

        const { exists } = await checkIdempotency(idempotencyKey);
        if (exists) {
            await db.cancelledItems.update(item.id!, { syncStatus: 'SYNCED', syncedAt: new Date() });
            synced++;
            continue;
        }

        try {
            const order = await db.offlineOrders.get(item.orderLocalId);
            if (!order?.serverId) continue;

            const response = await fetch('/api/orders/sync-cancellation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotency_key: idempotencyKey,
                    order_id: order.serverId,
                    menu_item_id: item.menuItemId,
                    quantity: item.quantity,
                    reason: item.reason,
                    cancelled_by: item.cancelledBy,
                    cancelled_at: item.cancelledAt.toISOString(),
                }),
            });

            if (response.ok) {
                await db.cancelledItems.update(item.id!, { syncStatus: 'SYNCED', syncedAt: new Date() });
                synced++;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch {
            failed++;
            await db.cancelledItems.update(item.id!, { syncStatus: 'FAILED' });
        }
    }

    return { synced, failed };
}

// ==================== EXPORTS ====================

export { validateLicense };
