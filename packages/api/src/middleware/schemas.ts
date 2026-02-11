// Zod Schemas for API Input Validation
import { z } from 'zod';

// ─── Auth Schemas ──────────────────────────────────────────
export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required').max(100),
    role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN']).optional().default('CASHIER'),
});

// ─── Order Schemas ─────────────────────────────────────────
const orderItemSchema = z.object({
    menuItemId: z.string().uuid('Invalid menu item ID'),
    variantId: z.string().uuid().optional().nullable(),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999),
    notes: z.string().max(500).optional(),
    addons: z.array(z.string().uuid()).optional(),
});

export const createOrderSchema = z.object({
    orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'ONLINE']),
    tableId: z.string().uuid().optional().nullable(),
    customerName: z.string().max(100).optional().default(''),
    customerPhone: z.string().max(20).optional().default(''),
    items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
    discountValue: z.number().min(0).max(100000).optional().default(0),
    notes: z.string().max(1000).optional().default(''),
    onlineOrderId: z.string().optional().nullable(),
    onlinePlatform: z.string().optional().nullable(),
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED']),
    reason: z.string().max(500).optional(),
});

export const orderPaymentSchema = z.object({
    paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'SPLIT', 'OTHER']),
    amountPaid: z.number().min(0),
    splitPayments: z.array(z.object({
        method: z.enum(['CASH', 'CARD', 'UPI', 'OTHER']),
        amount: z.number().min(0),
    })).optional(),
});

// ─── Menu Schemas ──────────────────────────────────────────
export const createMenuItemSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    price: z.number().min(0, 'Price must be positive').max(1000000),
    categoryId: z.string().uuid('Invalid category ID'),
    description: z.string().max(1000).optional().default(''),
    isVeg: z.boolean().optional().default(true),
    isAvailable: z.boolean().optional().default(true),
    hasGST: z.boolean().optional().default(false),
    gstPercent: z.number().min(0).max(100).optional().default(0),
    image: z.string().url().optional().nullable(),
});

export const createCategorySchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    icon: z.string().max(50).optional().default('🍽️'),
    color: z.string().max(20).optional(),
});

// ─── Table Schemas ─────────────────────────────────────────
export const createTableSchema = z.object({
    name: z.string().min(1, 'Table name is required').max(50),
    capacity: z.number().int().min(1).max(100).optional().default(4),
});

export const updateTableStatusSchema = z.object({
    status: z.enum(['EMPTY', 'OCCUPIED', 'RESERVED', 'CLEANING']),
});

// ─── User Schemas ──────────────────────────────────────────
export const createUserSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['MANAGER', 'CASHIER', 'KITCHEN']),
    phone: z.string().max(20).optional(),
});
