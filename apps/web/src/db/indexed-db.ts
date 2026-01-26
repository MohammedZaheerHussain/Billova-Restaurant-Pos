// Billova Offline Database - Using Dexie.js for IndexedDB
import Dexie, { Table } from 'dexie';

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

    constructor() {
        super('BillovaOfflineDB');

        this.version(1).stores({
            offlineOrders: 'localId, status, branchId, createdAt, syncedAt',
            offlinePayments: 'localId, orderLocalId, status',
            syncLogs: '++id, entityType, localId, action, createdAt',
            cachedMenuItems: 'id, branchId, categoryId, name',
            cachedCategories: 'id, branchId, sortOrder',
            cachedTables: 'id, branchId, status',
            syncFailures: '++id, entityType, localId, flaggedForAdmin, createdAt',
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
