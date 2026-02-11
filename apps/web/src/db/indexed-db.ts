// Billova Offline Database - Using Dexie.js for IndexedDB
import Dexie, { Table } from 'dexie';
import { logger } from '../utils/logger';

// ==================== TYPES ====================

export interface OfflineOrderItem {
    menuItemId: string;
    menuItemName: string;
    variantId?: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    notes?: string;
    addons?: {
        addonId: string;
        name: string;
        price: number;
    }[];
}

export interface OfflineOrder {
    localId: string;           // UUID - primary key
    serverId?: string;         // Set after successful sync
    tempBillNumber: string;    // TEMP-XXXX format
    serverBillNumber?: string; // Real bill number after sync
    branchId: string;
    tableId?: string;
    tableName?: string;
    userId: string;
    userName: string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';
    customerName?: string;
    customerPhone?: string;
    items: OfflineOrderItem[];
    subtotal: number;
    discountType?: 'PERCENTAGE' | 'FIXED';
    discountValue?: number;
    discountAmount: number;
    gstAmount: number;
    total: number;
    notes?: string;
    status: 'CREATED' | 'PAID' | 'SYNCING' | 'SYNCED' | 'FAILED';
    syncAttempts: number;
    lastSyncError?: string;
    createdAt: Date;
    updatedAt: Date;
    syncedAt?: Date;
}

export interface OfflinePayment {
    localId: string;
    orderLocalId: string;      // Links to OfflineOrder.localId
    serverId?: string;
    mode: 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'SPLIT';
    amount: number;
    reference?: string;        // UPI ref, card last 4, etc.
    status: 'PENDING' | 'SYNCED' | 'FAILED';
    createdAt: Date;
}

export interface SyncLog {
    id?: number;               // Auto-increment
    entityType: 'ORDER' | 'PAYMENT' | 'KOT';
    localId: string;
    action: 'SYNC_ATTEMPT' | 'SYNC_SUCCESS' | 'SYNC_FAILED' | 'FLAGGED_ADMIN';
    serverId?: string;
    errorMessage?: string;
    attemptNumber: number;
    createdAt: Date;
}

export interface CachedMenuItem {
    id: string;
    branchId: string;
    categoryId: string;
    categoryName: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    isVeg: boolean;
    isAvailable: boolean;
    hasGST: boolean;
    gstPercent: number;
    variants?: {
        id: string;
        name: string;
        price: number;
        isDefault: boolean;
    }[];
    addons?: {
        id: string;
        name: string;
        price: number;
        category: string;
    }[];
    cachedAt: Date;
}

export interface CachedCategory {
    id: string;
    branchId: string;
    name: string;
    icon?: string;
    color?: string;
    sortOrder: number;
    cachedAt: Date;
}

export interface CachedTable {
    id: string;
    branchId: string;
    name: string;
    capacity: number;
    status: 'EMPTY' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
    cachedAt: Date;
}

export interface SyncFailure {
    id?: number;
    entityType: 'ORDER' | 'PAYMENT';
    localId: string;
    errorMessage: string;
    payload: string;           // JSON stringified order/payment
    attempts: number;
    flaggedForAdmin: boolean;
    resolvedAt?: Date;
    createdAt: Date;
}

// ==================== KOT & STATUS TYPES ====================

export interface OfflineKOT {
    localId: string;
    serverId?: string;
    orderLocalId: string;      // Links to OfflineOrder.localId
    branchId: string;
    kotNumber: string;         // KOT-XXXX format
    items: {
        menuItemId: string;
        menuItemName: string;
        quantity: number;
        notes?: string;
    }[];
    status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'SYNCED';
    syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
    createdAt: Date;
    syncedAt?: Date;
}

export interface OfflineOrderStatus {
    id?: number;
    orderLocalId: string;
    previousStatus: string;
    newStatus: string;
    changedBy: string;
    changedAt: Date;
    syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
    syncedAt?: Date;
}

export interface OfflineCancelledItem {
    id?: number;
    orderLocalId: string;
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    reason: string;
    cancelledBy: string;
    cancelledAt: Date;
    syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
    syncedAt?: Date;
}

export interface PrintHistoryEntry {
    id?: number;
    orderId: string;
    orderLocalId?: string;
    printType: 'bill' | 'kot' | 'reprint';
    printerName: string;
    printerId: string;
    status: 'success' | 'failed';
    error?: string;
    printedAt: Date;
    deviceId: string;
}

// ==================== DATABASE CLASS ====================

export class BillovaDB extends Dexie {
    // Tables
    offlineOrders!: Table<OfflineOrder, string>;
    offlinePayments!: Table<OfflinePayment, string>;
    syncLogs!: Table<SyncLog, number>;
    cachedMenuItems!: Table<CachedMenuItem, string>;
    cachedCategories!: Table<CachedCategory, string>;
    cachedTables!: Table<CachedTable, string>;
    syncFailures!: Table<SyncFailure, number>;
    // New tables for v2
    offlineKOTs!: Table<OfflineKOT, string>;
    orderStatusHistory!: Table<OfflineOrderStatus, number>;
    cancelledItems!: Table<OfflineCancelledItem, number>;
    printHistory!: Table<PrintHistoryEntry, number>;

    constructor() {
        super('BillovaOfflineDB');

        // Version 1 - Original schema
        this.version(1).stores({
            offlineOrders: 'localId, status, branchId, createdAt, syncedAt',
            offlinePayments: 'localId, orderLocalId, status',
            syncLogs: '++id, entityType, localId, action, createdAt',
            cachedMenuItems: 'id, branchId, categoryId, name',
            cachedCategories: 'id, branchId, sortOrder',
            cachedTables: 'id, branchId, status',
            syncFailures: '++id, entityType, localId, flaggedForAdmin, createdAt',
        });

        // Version 2 - Add KOT, OrderStatus, CancelledItems
        this.version(2).stores({
            offlineOrders: 'localId, status, branchId, createdAt, syncedAt',
            offlinePayments: 'localId, orderLocalId, status',
            syncLogs: '++id, entityType, localId, action, createdAt',
            cachedMenuItems: 'id, branchId, categoryId, name',
            cachedCategories: 'id, branchId, sortOrder',
            cachedTables: 'id, branchId, status',
            syncFailures: '++id, entityType, localId, flaggedForAdmin, createdAt',
            // New tables
            offlineKOTs: 'localId, orderLocalId, branchId, syncStatus, createdAt',
            orderStatusHistory: '++id, orderLocalId, syncStatus, changedAt',
            cancelledItems: '++id, orderLocalId, syncStatus, cancelledAt',
        });

        // Version 3 - Add print history
        this.version(3).stores({
            offlineOrders: 'localId, status, branchId, createdAt, syncedAt',
            offlinePayments: 'localId, orderLocalId, status',
            syncLogs: '++id, entityType, localId, action, createdAt',
            cachedMenuItems: 'id, branchId, categoryId, name',
            cachedCategories: 'id, branchId, sortOrder',
            cachedTables: 'id, branchId, status',
            syncFailures: '++id, entityType, localId, flaggedForAdmin, createdAt',
            offlineKOTs: 'localId, orderLocalId, branchId, syncStatus, createdAt',
            orderStatusHistory: '++id, orderLocalId, syncStatus, changedAt',
            cancelledItems: '++id, orderLocalId, syncStatus, cancelledAt',
            printHistory: '++id, orderId, printType, status, printedAt, deviceId',
        });
    }
}

// Singleton instance
export const db = new BillovaDB();

// ==================== HELPER FUNCTIONS ====================

// Generate unique ID
export function generateLocalId(): string {
    return crypto.randomUUID();
}

// Generate temporary bill number
let tempBillCounter = 0;
export function generateTempBillNumber(): string {
    tempBillCounter++;
    const paddedNumber = String(tempBillCounter).padStart(4, '0');
    return `TEMP-${paddedNumber}`;
}

// Reset temp bill counter (call on app start after loading existing)
export async function initializeTempBillCounter(): Promise<void> {
    const orders = await db.offlineOrders.toArray();
    const maxNumber = orders.reduce((max, order) => {
        const match = order.tempBillNumber.match(/TEMP-(\d+)/);
        if (match) {
            const num = parseInt(match[1], 10);
            return Math.max(max, num);
        }
        return max;
    }, 0);
    tempBillCounter = maxNumber;
}

// Generate hash for duplicate detection
export function generateOrderHash(order: OfflineOrder): string {
    const hashData = {
        branchId: order.branchId,
        tableId: order.tableId,
        items: order.items.map(i => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            variantId: i.variantId,
        })),
        total: order.total,
        createdAt: order.createdAt.toISOString(),
    };
    return btoa(JSON.stringify(hashData));
}

// ==================== STORAGE MANAGEMENT ====================

const STORAGE_CONFIG = {
    MAX_SYNC_LOGS: 5000,          // Keep last N sync logs
    MAX_SYNCED_ORDERS_AGE_DAYS: 7, // Keep synced orders for N days locally
    MAX_CACHE_AGE_HOURS: 24,       // Refresh cache after N hours
    STORAGE_WARNING_MB: 40,        // Warn when storage exceeds this
    STORAGE_CRITICAL_MB: 45,       // Force purge when exceeds this
};

/**
 * Get current storage usage estimate
 */
export async function getStorageUsage(): Promise<{
    usage: number;
    quota: number;
    percentage: number;
}> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        return {
            usage,
            quota,
            percentage: quota > 0 ? Math.round((usage / quota) * 100) : 0,
        };
    }
    return { usage: 0, quota: 0, percentage: 0 };
}

/**
 * Check storage pressure and return status
 */
export async function checkStoragePressure(): Promise<{
    status: 'OK' | 'WARNING' | 'CRITICAL';
    usageMB: number;
    message?: string;
}> {
    const { usage, percentage } = await getStorageUsage();
    const usageMB = Math.round(usage / (1024 * 1024));

    if (usageMB > STORAGE_CONFIG.STORAGE_CRITICAL_MB || percentage > 90) {
        return {
            status: 'CRITICAL',
            usageMB,
            message: `Storage critical: ${usageMB}MB used. Auto-purge required.`,
        };
    }

    if (usageMB > STORAGE_CONFIG.STORAGE_WARNING_MB || percentage > 75) {
        return {
            status: 'WARNING',
            usageMB,
            message: `Storage warning: ${usageMB}MB used. Consider cleaning.`,
        };
    }

    return { status: 'OK', usageMB };
}

/**
 * Purge old synced orders to free storage
 */
export async function purgeOldSyncedOrders(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STORAGE_CONFIG.MAX_SYNCED_ORDERS_AGE_DAYS);

    const oldOrders = await db.offlineOrders
        .where('status')
        .equals('SYNCED')
        .filter(o => Boolean(o.syncedAt && o.syncedAt < cutoffDate))
        .toArray();

    const localIds = oldOrders.map(o => o.localId);

    // Delete related data
    for (const localId of localIds) {
        await db.offlinePayments.where('orderLocalId').equals(localId).delete();
        await db.offlineKOTs.where('orderLocalId').equals(localId).delete();
        await db.orderStatusHistory.where('orderLocalId').equals(localId).delete();
        await db.cancelledItems.where('orderLocalId').equals(localId).delete();
    }

    // Delete orders
    await db.offlineOrders.bulkDelete(localIds);

    if (localIds.length > 0) {
        logger.debug(`[Storage] Purged ${localIds.length} old synced orders`);
    }

    return localIds.length;
}

/**
 * Purge old sync logs
 */
export async function purgeSyncLogs(): Promise<number> {
    const totalLogs = await db.syncLogs.count();

    if (totalLogs > STORAGE_CONFIG.MAX_SYNC_LOGS) {
        const excess = totalLogs - STORAGE_CONFIG.MAX_SYNC_LOGS;
        const oldestLogs = await db.syncLogs.orderBy('createdAt').limit(excess).primaryKeys();
        await db.syncLogs.bulkDelete(oldestLogs);
        logger.debug(`[Storage] Purged ${excess} old sync logs`);
        return excess;
    }

    return 0;
}

/**
 * Refresh stale cache
 */
export async function purgeStaleCache(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - STORAGE_CONFIG.MAX_CACHE_AGE_HOURS);

    const [menuDeleted, categoryDeleted, tableDeleted] = await Promise.all([
        db.cachedMenuItems.filter(i => i.cachedAt < cutoffDate).delete(),
        db.cachedCategories.filter(c => c.cachedAt < cutoffDate).delete(),
        db.cachedTables.filter(t => t.cachedAt < cutoffDate).delete(),
    ]);

    const total = menuDeleted + categoryDeleted + tableDeleted;
    if (total > 0) {
        logger.debug(`[Storage] Purged ${total} stale cache entries`);
    }

    return total;
}

/**
 * Auto-manage storage based on pressure
 */
export async function autoManageStorage(): Promise<void> {
    const pressure = await checkStoragePressure();

    if (pressure.status === 'CRITICAL') {
        logger.debug('[Storage] Critical pressure - performing aggressive cleanup');
        await purgeSyncLogs();
        await purgeOldSyncedOrders();
        await purgeStaleCache();
        await db.syncFailures.where('resolvedAt').above(new Date(0)).delete();
    } else if (pressure.status === 'WARNING') {
        logger.debug('[Storage] Warning pressure - performing light cleanup');
        await purgeSyncLogs();
        await purgeStaleCache();
    }
}

// ==================== DATA INTEGRITY ====================

/**
 * Validate data integrity for orders
 */
export async function validateOrderIntegrity(): Promise<{
    valid: number;
    corrupted: number;
    fixed: number;
}> {
    const orders = await db.offlineOrders.toArray();
    let valid = 0;
    let corrupted = 0;
    let fixed = 0;

    for (const order of orders) {
        try {
            // Check required fields
            if (!order.localId || !order.branchId || !order.items) {
                corrupted++;
                continue;
            }

            // Validate items total
            const calculatedSubtotal = order.items.reduce((sum, item) => sum + item.total, 0);
            if (Math.abs(calculatedSubtotal - order.subtotal) > 0.01) {
                // Auto-fix subtotal
                await db.offlineOrders.update(order.localId, {
                    subtotal: calculatedSubtotal,
                    updatedAt: new Date(),
                });
                fixed++;
            }

            valid++;
        } catch (e) {
            corrupted++;
        }
    }

    return { valid, corrupted, fixed };
}

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<{
    healthy: boolean;
    tables: { name: string; count: number; status: 'OK' | 'ERROR' }[];
    storageUsage: number;
}> {
    const tables: { name: string; count: number; status: 'OK' | 'ERROR' }[] = [];

    try {
        tables.push({ name: 'offlineOrders', count: await db.offlineOrders.count(), status: 'OK' });
        tables.push({ name: 'offlinePayments', count: await db.offlinePayments.count(), status: 'OK' });
        tables.push({ name: 'syncLogs', count: await db.syncLogs.count(), status: 'OK' });
        tables.push({ name: 'cachedMenuItems', count: await db.cachedMenuItems.count(), status: 'OK' });
        tables.push({ name: 'cachedCategories', count: await db.cachedCategories.count(), status: 'OK' });
        tables.push({ name: 'cachedTables', count: await db.cachedTables.count(), status: 'OK' });
        tables.push({ name: 'syncFailures', count: await db.syncFailures.count(), status: 'OK' });
        tables.push({ name: 'offlineKOTs', count: await db.offlineKOTs.count(), status: 'OK' });
    } catch (e) {
        logger.error('[DB Health] Error checking tables:', e);
    }

    const { usage } = await getStorageUsage();
    const storageUsageMB = Math.round(usage / (1024 * 1024));

    return {
        healthy: tables.every(t => t.status === 'OK'),
        tables,
        storageUsage: storageUsageMB,
    };
}

// ==================== INITIALIZATION ====================

/**
 * Initialize database on app start
 */
export async function initializeDatabase(): Promise<void> {
    logger.debug('[DB] Initializing Billova Offline Database...');

    // Initialize temp bill counter
    await initializeTempBillCounter();

    // Check health
    const health = await checkDatabaseHealth();
    logger.debug(`[DB] Health check: ${health.healthy ? 'OK' : 'ISSUES'}, Storage: ${health.storageUsage}MB`);

    // Auto-manage storage
    await autoManageStorage();

    // Validate integrity
    const integrity = await validateOrderIntegrity();
    if (integrity.fixed > 0) {
        logger.debug(`[DB] Fixed ${integrity.fixed} order integrity issues`);
    }

    logger.debug('[DB] Database initialized successfully');
}
