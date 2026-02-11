// Cart Persistence - Auto-save and crash recovery for POS cart
// Step 4 of Phase 1: Bulletproof Offline Engine

import Dexie, { Table } from 'dexie';

// ==================== TYPES ====================

export interface CartItem {
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

export interface PersistedCart {
    id?: number;
    device_id: string;
    branch_id: string;
    user_id: string;

    // Cart data
    items: CartItem[];
    tableId?: string;
    tableName?: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';

    // Discounts
    discountType?: 'PERCENTAGE' | 'FIXED';
    discountValue?: number;
    notes?: string;

    // State flags
    checkoutStarted: boolean;

    // Timestamps
    created_at: number;
    updated_at: number;
}

export interface CartRestoreResult {
    shouldRestore: boolean;
    cart?: PersistedCart;
    reason?: string;
}

// ==================== CONFIGURATION ====================

const CART_CONFIG = {
    DB_NAME: 'BillovaCartPersistence',
    SCHEMA_VERSION: 1,
    AUTO_SAVE_INTERVAL_MS: 2000,  // Auto-save every 2 seconds
    STALE_TIMEOUT_MINUTES: 30,    // Ask to restore if older than 30 min
    MAX_AGE_HOURS: 24,             // Don't restore if older than 24 hours
};

// ==================== DATABASE ====================

class CartDB extends Dexie {
    carts!: Table<PersistedCart, number>;

    constructor() {
        super(CART_CONFIG.DB_NAME);

        this.version(CART_CONFIG.SCHEMA_VERSION).stores({
            carts: '++id, device_id, branch_id, user_id, updated_at',
        });
    }
}

const cartDB = new CartDB();

// ==================== CART PERSISTENCE CLASS ====================

class CartPersistence {
    private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
    private currentCart: Partial<PersistedCart> | null = null;
    private deviceId: string = '';
    private branchId: string = '';
    private userId: string = '';

    /**
     * Initialize cart persistence for a user session
     */
    async initialize(deviceId: string, branchId: string, userId: string): Promise<void> {
        this.deviceId = deviceId;
        this.branchId = branchId;
        this.userId = userId;

        console.log('[CartPersistence] Initialized for:', { deviceId, branchId, userId });
    }

    /**
     * Start auto-save interval
     */
    startAutoSave(getCartData: () => Partial<PersistedCart>): void {
        this.stopAutoSave(); // Clear any existing interval

        this.autoSaveInterval = setInterval(async () => {
            const cartData = getCartData();
            if (cartData.items && cartData.items.length > 0) {
                await this.saveCart(cartData);
            }
        }, CART_CONFIG.AUTO_SAVE_INTERVAL_MS);

        console.log('[CartPersistence] Auto-save started');
    }

    /**
     * Stop auto-save interval
     */
    stopAutoSave(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log('[CartPersistence] Auto-save stopped');
        }
    }

    /**
     * Save cart to IndexedDB
     */
    async saveCart(cartData: Partial<PersistedCart>): Promise<void> {
        if (!this.deviceId || !this.branchId || !this.userId) {
            console.warn('[CartPersistence] Not initialized, skipping save');
            return;
        }

        try {
            // Check if cart exists for this device/branch/user
            const existing = await cartDB.carts
                .where('device_id')
                .equals(this.deviceId)
                .filter(c => c.branch_id === this.branchId && c.user_id === this.userId)
                .first();

            const cart: PersistedCart = {
                ...(existing || {}),
                device_id: this.deviceId,
                branch_id: this.branchId,
                user_id: this.userId,
                items: cartData.items || [],
                tableId: cartData.tableId,
                tableName: cartData.tableName,
                customerId: cartData.customerId,
                customerName: cartData.customerName,
                customerPhone: cartData.customerPhone,
                orderType: cartData.orderType || 'DINE_IN',
                discountType: cartData.discountType,
                discountValue: cartData.discountValue,
                notes: cartData.notes,
                checkoutStarted: cartData.checkoutStarted || false,
                created_at: existing?.created_at || Date.now(),
                updated_at: Date.now(),
            };

            if (existing?.id) {
                // Use put to replace the entire record (avoids UpdateSpec type issues)
                await cartDB.carts.put({ ...cart, id: existing.id });
            } else {
                await cartDB.carts.add(cart);
            }

            this.currentCart = cart;
        } catch (error) {
            console.error('[CartPersistence] Save failed:', error);
        }
    }

    /**
     * Check if there's a cart to restore
     * Returns info for showing confirmation dialog
     */
    async checkForRestore(): Promise<CartRestoreResult> {
        if (!this.deviceId || !this.branchId || !this.userId) {
            return { shouldRestore: false, reason: 'Not initialized' };
        }

        try {
            const existing = await cartDB.carts
                .where('device_id')
                .equals(this.deviceId)
                .filter(c => c.branch_id === this.branchId && c.user_id === this.userId)
                .first();

            if (!existing || !existing.items || existing.items.length === 0) {
                return { shouldRestore: false, reason: 'No cart found' };
            }

            const now = Date.now();
            const ageHours = (now - existing.updated_at) / (1000 * 60 * 60);
            const ageMinutes = (now - existing.updated_at) / (1000 * 60);

            // Don't restore if too old
            if (ageHours > CART_CONFIG.MAX_AGE_HOURS) {
                await this.clearCart();
                return { shouldRestore: false, reason: 'Cart too old (over 24 hours)' };
            }

            // Restore with confirmation
            return {
                shouldRestore: true,
                cart: existing,
                reason: ageMinutes > CART_CONFIG.STALE_TIMEOUT_MINUTES
                    ? `Cart from ${Math.round(ageMinutes)} minutes ago`
                    : `Recent cart with ${existing.items.length} items`,
            };
        } catch (error) {
            console.error('[CartPersistence] Check for restore failed:', error);
            return { shouldRestore: false, reason: 'Error checking cart' };
        }
    }

    /**
     * Get the saved cart for restoration
     */
    async getCart(): Promise<PersistedCart | null> {
        if (!this.deviceId || !this.branchId || !this.userId) {
            return null;
        }

        try {
            return await cartDB.carts
                .where('device_id')
                .equals(this.deviceId)
                .filter(c => c.branch_id === this.branchId && c.user_id === this.userId)
                .first() || null;
        } catch (error) {
            console.error('[CartPersistence] Get cart failed:', error);
            return null;
        }
    }

    /**
     * Clear the saved cart (after successful checkout or user dismissal)
     */
    async clearCart(): Promise<void> {
        if (!this.deviceId || !this.branchId || !this.userId) {
            return;
        }

        try {
            await cartDB.carts
                .where('device_id')
                .equals(this.deviceId)
                .filter(c => c.branch_id === this.branchId && c.user_id === this.userId)
                .delete();

            this.currentCart = null;
            console.log('[CartPersistence] Cart cleared');
        } catch (error) {
            console.error('[CartPersistence] Clear cart failed:', error);
        }
    }

    /**
     * Mark checkout as started (for recovery purposes)
     */
    async markCheckoutStarted(): Promise<void> {
        if (this.currentCart) {
            await this.saveCart({ ...this.currentCart, checkoutStarted: true });
        }
    }

    /**
     * Mark checkout as complete (clears cart)
     */
    async markCheckoutComplete(): Promise<void> {
        await this.clearCart();
        this.stopAutoSave();
    }

    /**
     * Get cart info for display
     */
    getCartInfo(): {
        itemCount: number;
        total: number;
        lastSaved?: string
    } | null {
        if (!this.currentCart || !this.currentCart.items) {
            return null;
        }

        const total = this.currentCart.items.reduce((sum, item) => sum + item.total, 0);

        return {
            itemCount: this.currentCart.items.length,
            total,
            lastSaved: this.currentCart.updated_at
                ? new Date(this.currentCart.updated_at).toLocaleTimeString()
                : undefined,
        };
    }

    /**
     * Clean up old carts from other users/sessions
     */
    async cleanupOldCarts(): Promise<number> {
        const cutoff = Date.now() - (CART_CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000);

        const oldCarts = await cartDB.carts
            .filter(c => c.updated_at < cutoff)
            .primaryKeys();

        await cartDB.carts.bulkDelete(oldCarts);

        if (oldCarts.length > 0) {
            console.log(`[CartPersistence] Cleaned up ${oldCarts.length} old carts`);
        }

        return oldCarts.length;
    }
}

// ==================== SINGLETON & EXPORTS ====================

export const cartPersistence = new CartPersistence();

// Export database for advanced usage
export { cartDB };

export default cartPersistence;
