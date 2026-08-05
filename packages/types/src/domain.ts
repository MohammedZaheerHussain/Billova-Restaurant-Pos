// Billova POS - Universal Domain Entity Interfaces
import {
    UserRole,
    SubscriptionPlan,
    TableStatus,
    OrderType,
    OrderStatus,
    DiscountType,
    PaymentMode,
    KOTStatus,
    InventoryCategory,
    StockStatus
} from './database.js';

export interface Branch {
    id: string;
    orgId?: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    gstNumber?: string;
    timezone: string;
    subscriptionPlan?: SubscriptionPlan;
    subscriptionExpiry?: string;
    isActive: boolean;
    settings?: Record<string, unknown>;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
    branchId?: string;
    branch?: Branch;
    isActive?: boolean;
}

export interface MenuItemVariant {
    id: string;
    menuItemId?: string;
    name: string;
    price: number;
    isDefault: boolean;
}

export interface Addon {
    id: string;
    name: string;
    price: number;
    category?: string;
}

export interface Category {
    id: string;
    branchId?: string;
    name: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
    itemCount?: number;
}

export interface MenuItem {
    id: string;
    branchId?: string;
    categoryId: string;
    category?: Category;
    name: string;
    description?: string;
    price: number;
    image?: string;
    isVeg: boolean;
    isAvailable: boolean;
    hasGST?: boolean;
    gstPercent?: number;
    variants?: MenuItemVariant[];
    addons?: Addon[];
    sortOrder?: number;
}

export interface TableEntity {
    id: string;
    branchId?: string;
    name: string;
    capacity: number;
    status: TableStatus;
    qrToken?: string;
    currentOrderId?: string;
}

export interface OrderItem {
    id: string;
    orderId?: string;
    menuItemId: string;
    menuItem?: MenuItem;
    variantId?: string;
    variant?: MenuItemVariant;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    notes?: string;
    addons?: Addon[];
    status?: KOTStatus;
}

export interface OrderPayment {
    id?: string;
    orderId?: string;
    mode: PaymentMode;
    amount: number;
    reference?: string;
    createdAt?: string;
}

export interface Order {
    id: string;
    branchId: string;
    orderNumber: number;
    billNumber?: string;
    tempBillNumber?: string;
    orderType: OrderType;
    status: OrderStatus;
    tableId?: string | null;
    tableName?: string;
    customerName?: string;
    customerPhone?: string;
    items: OrderItem[];
    subtotal: number;
    discountType?: DiscountType | null;
    discountValue?: number;
    discountAmount: number;
    gstAmount: number;
    total: number;
    payments?: OrderPayment[];
    notes?: string;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
    updatedAt: string;
    syncedFromOffline?: boolean;
}

export interface InventoryItem {
    id: string;
    branchId: string;
    name: string;
    sku?: string;
    quantity: number;
    unit: string;
    minStock: number;
    costPrice?: number;
    linkedMenuItemId?: string;
    category: InventoryCategory;
    status: StockStatus;
    lastSyncedAt?: string;
}

export interface Supplier {
    id: string;
    branchId: string;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    gstNumber?: string;
    address?: string;
}

export interface Customer {
    id: string;
    branchId: string;
    name: string;
    phone: string;
    email?: string;
    loyaltyPoints?: number;
    totalOrders?: number;
    totalSpent?: number;
}

export interface PrinterDevice {
    id: string;
    name: string;
    type: 'thermal_usb' | 'bluetooth' | 'network' | 'browser';
    ipAddress?: string;
    port?: number;
    paperWidthMm: 58 | 80;
    isDefault: boolean;
    isKOTPrinter: boolean;
}

export interface KOTTicket {
    id: string;
    kotNumber: string;
    orderId: string;
    tableName?: string;
    orderType: OrderType;
    items: {
        menuItemId: string;
        name: string;
        quantity: number;
        variantName?: string;
        notes?: string;
    }[];
    status: KOTStatus;
    createdAt: string;
}
