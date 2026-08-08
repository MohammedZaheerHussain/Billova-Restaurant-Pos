// Billova POS - Standardized Request & Response DTOs
import { OrderType, OrderStatus, DiscountType, PaymentMode, UserRole } from './database.js';

export interface APIErrorResponse {
    error: string;
    message?: string;
    statusCode?: number;
    stack?: string;
}

export interface APISuccessResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface AuthLoginResponse {
    token: string;
    user: Record<string, unknown>;
}

export interface CreateOrderDTO {
    orderType: OrderType;
    tableId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    items: {
        menuItemId: string;
        variantId?: string | null;
        quantity: number;
        notes?: string | null;
        addons?: string[];
    }[];
    discountType?: DiscountType | null;
    discountValue?: number;
    notes?: string | null;
    onlineOrderId?: string | null;
    onlinePlatform?: string | null;
}

export interface UpdateOrderStatusDTO {
    status: OrderStatus;
    reason?: string;
}

export interface AddPaymentDTO {
    paymentMethod?: PaymentMode | string;
    mode?: PaymentMode | string;
    amountPaid?: number;
    amount?: number;
    reference?: string;
    splitPayments?: {
        method: PaymentMode;
        amount: number;
    }[];
}

export interface CreateMenuItemDTO {
    name: string;
    price: number;
    categoryId: string;
    branchId?: string;
    description?: string;
    isVeg?: boolean;
    isAvailable?: boolean;
    hasGST?: boolean;
    gstPercent?: number;
    image?: string | null;
}

export interface CreateCategoryDTO {
    name: string;
    branchId?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
}

export interface CreateTableDTO {
    name: string;
    capacity?: number;
}

export interface CreateUserDTO {
    name: string;
    email: string;
    password?: string;
    role: UserRole | string;
    phone?: string;
}

export interface OrderQueryDTO {
    branchId?: string;
    status?: OrderStatus;
    orderType?: OrderType;
    startDate?: string;
    endDate?: string;
    date?: string;
    page?: number;
    limit?: number;
}

export interface DashboardSummaryDTO {
    totalSales: number;
    orderCount: number;
    activeTables: number;
    topSellingItems: {
        name: string;
        quantity: number;
        revenue: number;
    }[];
    salesByHour: {
        hour: string;
        sales: number;
    }[];
}
