import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Zustand store tests — we test the store logic patterns
 * used throughout Billova POS (cart, sync, auth).
 */
describe('Cart Store Logic', () => {
    // Simulate cart state and operations (pure logic, no Zustand dependency)
    interface CartItem {
        id: string;
        name: string;
        price: number;
        quantity: number;
        addons: { name: string; price: number }[];
    }

    let cart: CartItem[];

    beforeEach(() => {
        cart = [];
    });

    function addToCart(item: Omit<CartItem, 'quantity' | 'addons'>) {
        const existing = cart.find(i => i.id === item.id);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...item, quantity: 1, addons: [] });
        }
    }

    function removeFromCart(id: string) {
        cart = cart.filter(i => i.id !== id);
    }

    function updateQuantity(id: string, qty: number) {
        const item = cart.find(i => i.id === id);
        if (item) {
            item.quantity = Math.max(0, qty);
            if (item.quantity === 0) {
                removeFromCart(id);
                return;
            }
        }
    }

    function addAddon(itemId: string, addon: { name: string; price: number }) {
        const item = cart.find(i => i.id === itemId);
        if (item) {
            item.addons.push(addon);
        }
    }

    function getSubtotal(): number {
        return cart.reduce((sum, item) => {
            const addonTotal = item.addons.reduce((a, addon) => a + addon.price, 0);
            return sum + (item.price + addonTotal) * item.quantity;
        }, 0);
    }

    function getItemCount(): number {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    it('should start with empty cart', () => {
        expect(cart).toHaveLength(0);
        expect(getSubtotal()).toBe(0);
        expect(getItemCount()).toBe(0);
    });

    it('should add item to cart', () => {
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        expect(cart).toHaveLength(1);
        expect(cart[0].quantity).toBe(1);
        expect(getSubtotal()).toBe(250);
    });

    it('should increment quantity for duplicate items', () => {
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        expect(cart).toHaveLength(1);
        expect(cart[0].quantity).toBe(2);
        expect(getSubtotal()).toBe(500);
    });

    it('should handle multiple different items', () => {
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        addToCart({ id: 'item-2', name: 'Butter Naan', price: 60 });
        addToCart({ id: 'item-3', name: 'Raita', price: 40 });
        expect(cart).toHaveLength(3);
        expect(getItemCount()).toBe(3);
        expect(getSubtotal()).toBe(350);
    });

    it('should remove item from cart', () => {
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        addToCart({ id: 'item-2', name: 'Butter Naan', price: 60 });
        removeFromCart('item-1');
        expect(cart).toHaveLength(1);
        expect(cart[0].name).toBe('Butter Naan');
    });

    it('should update quantity', () => {
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        updateQuantity('item-1', 5);
        expect(cart[0].quantity).toBe(5);
        expect(getSubtotal()).toBe(1250);
    });

    it('should auto-remove when quantity set to 0', () => {
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        updateQuantity('item-1', 0);
        expect(cart).toHaveLength(0);
    });

    it('should calculate subtotal with addons', () => {
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        addAddon('item-1', { name: 'Extra Raita', price: 30 });
        addAddon('item-1', { name: 'Extra Rice', price: 50 });
        // (250 + 30 + 50) * 1 = 330
        expect(getSubtotal()).toBe(330);
    });

    it('should calculate subtotal with addons and quantity', () => {
        addToCart({ id: 'item-1', name: 'Chicken Biryani', price: 250 });
        updateQuantity('item-1', 3);
        addAddon('item-1', { name: 'Extra Raita', price: 30 });
        // (250 + 30) * 3 = 840
        expect(getSubtotal()).toBe(840);
    });
});

describe('Auth Store Logic', () => {
    interface User {
        id: string;
        email: string;
        name: string;
        role: string;
        branchId: string | null;
    }

    let currentUser: User | null = null;
    let token: string | null = null;

    function login(user: User, authToken: string) {
        currentUser = user;
        token = authToken;
    }

    function logout() {
        currentUser = null;
        token = null;
    }

    function isAuthenticated(): boolean {
        return currentUser !== null && token !== null;
    }

    function hasRole(role: string): boolean {
        return currentUser?.role === role;
    }

    function canAccessBranch(branchId: string): boolean {
        if (!currentUser) return false;
        if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'OWNER') return true;
        return currentUser.branchId === branchId;
    }

    it('should start unauthenticated', () => {
        expect(isAuthenticated()).toBe(false);
        expect(currentUser).toBeNull();
    });

    it('should login correctly', () => {
        login(
            { id: '1', email: 'admin@test.com', name: 'Admin', role: 'OWNER', branchId: 'b1' },
            'jwt-token-123'
        );
        expect(isAuthenticated()).toBe(true);
        expect(currentUser?.name).toBe('Admin');
    });

    it('should logout correctly', () => {
        login(
            { id: '1', email: 'admin@test.com', name: 'Admin', role: 'OWNER', branchId: 'b1' },
            'jwt-token-123'
        );
        logout();
        expect(isAuthenticated()).toBe(false);
        expect(currentUser).toBeNull();
        expect(token).toBeNull();
    });

    it('should check roles correctly', () => {
        login(
            { id: '1', email: 'cashier@test.com', name: 'Cashier', role: 'CASHIER', branchId: 'b1' },
            'jwt-token'
        );
        expect(hasRole('CASHIER')).toBe(true);
        expect(hasRole('OWNER')).toBe(false);
        expect(hasRole('SUPER_ADMIN')).toBe(false);
    });

    it('should enforce branch access for staff', () => {
        login(
            { id: '1', email: 'cashier@test.com', name: 'Cashier', role: 'CASHIER', branchId: 'b1' },
            'jwt-token'
        );
        expect(canAccessBranch('b1')).toBe(true);
        expect(canAccessBranch('b2')).toBe(false);
    });

    it('should allow OWNER access to all branches', () => {
        login(
            { id: '1', email: 'owner@test.com', name: 'Owner', role: 'OWNER', branchId: 'b1' },
            'jwt-token'
        );
        expect(canAccessBranch('b1')).toBe(true);
        expect(canAccessBranch('b2')).toBe(true);
        expect(canAccessBranch('any-branch')).toBe(true);
    });

    it('should allow SUPER_ADMIN access to all branches', () => {
        login(
            { id: '1', email: 'sa@test.com', name: 'SA', role: 'SUPER_ADMIN', branchId: null },
            'jwt-token'
        );
        expect(canAccessBranch('b1')).toBe(true);
        expect(canAccessBranch('any')).toBe(true);
    });
});
