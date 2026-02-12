// Zustand Store for POS State Management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export interface MenuItem {
    id: string;
    name: string;
    price: number;
    categoryId: string;
    category?: { name: string; icon: string };
    isVeg: boolean;
    isAvailable: boolean;
    image?: string;
    description?: string;
    hasGST?: boolean;
    gstPercent?: number;
    variants?: MenuItemVariant[];
}

export interface MenuItemVariant {
    id: string;
    name: string;
    price: number;
    isDefault: boolean;
}

export interface CartItem {
    id: string;
    menuItem: MenuItem;
    variant?: MenuItemVariant;
    quantity: number;
    notes?: string;
    unitPrice: number;
    total: number;
}

export interface Category {
    id: string;
    name: string;
    icon: string;
    color?: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN';
    branch?: {
        id: string;
        name: string;
        subscriptionPlan?: 'BASIC' | 'PLUS' | 'PREMIUM';
        subscriptionExpiry?: string;
    };
}

export interface Table {
    id: string;
    name: string;
    status: 'EMPTY' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
    capacity: number;
}

// Cart Store
interface CartStore {
    items: CartItem[];
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'ONLINE';
    tableId: string | null;
    customerName: string;
    customerPhone: string;
    discountType: 'PERCENTAGE' | 'FIXED' | null;
    discountValue: number;
    notes: string;

    // Actions
    addItem: (menuItem: MenuItem, variant?: MenuItemVariant, notes?: string) => void;
    removeItem: (itemId: string) => void;
    updateQuantity: (itemId: string, quantity: number) => void;
    updateItemNotes: (itemId: string, notes: string) => void;
    clearCart: () => void;
    setOrderType: (type: 'DINE_IN' | 'TAKEAWAY' | 'ONLINE') => void;
    setTable: (tableId: string | null) => void;
    setCustomer: (name: string, phone: string) => void;
    setDiscount: (type: 'PERCENTAGE' | 'FIXED' | null, value: number) => void;
    setNotes: (notes: string) => void;

    // Computed
    getSubtotal: () => number;
    getDiscountAmount: () => number;
    getTotal: () => number;
    getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            orderType: 'DINE_IN',
            tableId: null,
            customerName: '',
            customerPhone: '',
            discountType: null,
            discountValue: 0,
            notes: '',

            addItem: (menuItem, variant, notes) => {
                // Convert price to number in case it's a Decimal/string from API
                const price = Number(variant?.price ?? menuItem.price) || 0;
                const itemId = variant ? `${menuItem.id}-${variant.id}` : menuItem.id;

                set((state) => {
                    const existingIndex = state.items.findIndex(
                        (item) => item.id === itemId && item.notes === notes
                    );

                    if (existingIndex >= 0) {
                        const newItems = [...state.items];
                        newItems[existingIndex] = {
                            ...newItems[existingIndex],
                            quantity: newItems[existingIndex].quantity + 1,
                            total: (newItems[existingIndex].quantity + 1) * price,
                        };
                        return { items: newItems };
                    }

                    return {
                        items: [
                            ...state.items,
                            {
                                id: itemId,
                                menuItem: { ...menuItem, price: Number(menuItem.price) || 0 },
                                variant: variant ? { ...variant, price: Number(variant.price) || 0 } : undefined,
                                quantity: 1,
                                notes,
                                unitPrice: price,
                                total: price,
                            },
                        ],
                    };
                });
            },

            removeItem: (itemId) => {
                set((state) => ({
                    items: state.items.filter((item) => item.id !== itemId),
                }));
            },

            updateQuantity: (itemId, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(itemId);
                    return;
                }

                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === itemId
                            ? { ...item, quantity, total: quantity * item.unitPrice }
                            : item
                    ),
                }));
            },

            updateItemNotes: (itemId, notes) => {
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === itemId ? { ...item, notes } : item
                    ),
                }));
            },

            clearCart: () => {
                set({
                    items: [],
                    tableId: null,
                    customerName: '',
                    customerPhone: '',
                    discountType: null,
                    discountValue: 0,
                    notes: '',
                });
            },

            setOrderType: (type) => set({ orderType: type }),
            setTable: (tableId) => set({ tableId }),
            setCustomer: (name, phone) => set({ customerName: name, customerPhone: phone }),
            setDiscount: (type, value) => set({ discountType: type, discountValue: value }),
            setNotes: (notes) => set({ notes }),

            getSubtotal: () => {
                const items = get().items || [];
                return items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
            },
            getDiscountAmount: () => {
                const subtotal = get().getSubtotal();
                const { discountType, discountValue } = get();

                if (!discountType || !discountValue) return 0;

                if (discountType === 'PERCENTAGE') {
                    return subtotal * (Number(discountValue) / 100);
                }
                return Number(discountValue) || 0;
            },
            getTotal: () => Math.max(0, get().getSubtotal() - get().getDiscountAmount()),
            getItemCount: () => {
                const items = get().items || [];
                return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            },
        }),
        {
            name: 'billova-cart',
        }
    )
);

// Auth Store
interface AuthStore {
    token: string | null;
    tokenExpiry: number | null; // Unix timestamp (ms) when token expires
    user: User | null;
    isAuthenticated: boolean;

    login: (token: string, user: User) => void;
    logout: () => void;
    isTokenExpired: () => boolean;
    checkAuth: () => boolean; // Returns true if still valid, false if expired (auto-logouts)
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            token: null,
            tokenExpiry: null,
            user: null,
            isAuthenticated: false,

            login: (token, user) => set({
                token,
                user,
                isAuthenticated: true,
                tokenExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24h from now
            }),
            logout: () => set({ token: null, tokenExpiry: null, user: null, isAuthenticated: false }),
            isTokenExpired: () => {
                const { tokenExpiry } = get();
                if (!tokenExpiry) return true;
                return Date.now() > tokenExpiry;
            },
            checkAuth: () => {
                const { isAuthenticated, isTokenExpired, logout } = get();
                if (isAuthenticated && isTokenExpired()) {
                    logout();
                    return false;
                }
                return isAuthenticated;
            },
        }),
        {
            name: 'billova-auth',
        }
    )
);

// UI Store
type Theme = 'dark' | 'light';

interface UIStore {
    sidebarOpen: boolean;
    activePage: string;
    selectedCategory: string | null;
    searchQuery: string;
    theme: Theme;

    toggleSidebar: () => void;
    setActivePage: (page: string) => void;
    setSelectedCategory: (categoryId: string | null) => void;
    setSearchQuery: (query: string) => void;
    toggleTheme: () => void;
}

const applyTheme = (theme: Theme) => {
    document.documentElement.setAttribute('data-theme', theme);
};

export const useUIStore = create<UIStore>()(
    persist(
        (set, get) => ({
            sidebarOpen: true,
            activePage: 'pos',
            selectedCategory: null,
            searchQuery: '',
            theme: 'dark',

            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            setActivePage: (page) => set({ activePage: page }),
            setSelectedCategory: (categoryId) => set({ selectedCategory: categoryId }),
            setSearchQuery: (query) => set({ searchQuery: query }),
            toggleTheme: () => {
                const newTheme = get().theme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme);
                set({ theme: newTheme });
            },
        }),
        {
            name: 'billova-ui',
            partialize: (state) => ({ theme: state.theme }),
            onRehydrateStorage: () => (state) => {
                if (state?.theme) applyTheme(state.theme);
            },
        }
    )
);
