// Billova POS - Canonical Supabase Database Types & Enums

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'DRIVER' | 'WAITER';
export type SubscriptionPlan = 'BASIC' | 'PLUS' | 'PREMIUM' | 'DEMO' | 'DEMO_PREMIUM';
export type TableStatus = 'EMPTY' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'ONLINE' | 'DELIVERY';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type PaymentMode = 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'ONLINE' | 'SPLIT';
export type KOTStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type InventoryCategory = 'INGREDIENT' | 'PACKAGING' | 'BEVERAGE' | 'RAW_MATERIAL' | 'FINISHED_GOODS' | 'OTHER';
export type StockStatus = 'SUFFICIENT' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK';
export type TransactionType = 'PURCHASE' | 'SALE' | 'WASTAGE' | 'ADJUSTMENT' | 'CONSUMPTION' | 'RESERVATION' | 'RELEASE' | 'BATCH_IMPORT' | 'DAMAGE' | 'EXPIRED' | 'PRODUCTION_USE' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'GRN_RECEIPT';

export interface Database {
    public: {
        Tables: {
            branches: {
                Row: {
                    id: string;
                    org_id: string | null;
                    name: string;
                    address: string | null;
                    phone: string | null;
                    email: string | null;
                    gst_number: string | null;
                    timezone: string;
                    subscription_plan: SubscriptionPlan;
                    subscription_expiry: string | null;
                    settings: Record<string, unknown>;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['branches']['Insert']>;
            };
            profiles: {
                Row: {
                    id: string;
                    org_id: string | null;
                    branch_id: string | null;
                    role: UserRole;
                    name: string;
                    email: string;
                    phone: string | null;
                    pin_code: string | null;
                    is_active: boolean;
                    permissions: Record<string, unknown> | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
            };
            categories: {
                Row: {
                    id: string;
                    branch_id: string;
                    name: string;
                    icon: string | null;
                    color: string | null;
                    sort_order: number;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['categories']['Insert']>;
            };
            menu_items: {
                Row: {
                    id: string;
                    branch_id: string;
                    category_id: string;
                    name: string;
                    description: string | null;
                    price: number;
                    image: string | null;
                    is_veg: boolean;
                    is_available: boolean;
                    has_gst: boolean;
                    gst_percent: number;
                    sort_order: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['menu_items']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['menu_items']['Insert']>;
            };
            tables: {
                Row: {
                    id: string;
                    branch_id: string;
                    name: string;
                    capacity: number;
                    status: TableStatus;
                    qr_token: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['tables']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['tables']['Insert']>;
            };
            orders: {
                Row: {
                    id: string;
                    branch_id: string;
                    order_number: number;
                    bill_number: string | null;
                    order_type: OrderType;
                    status: OrderStatus;
                    table_id: string | null;
                    table_number: string | null;
                    customer_name: string | null;
                    customer_phone: string | null;
                    subtotal: number;
                    discount_type: DiscountType | null;
                    discount_value: number;
                    discount_amount: number;
                    gst_amount: number;
                    total: number;
                    notes: string | null;
                    created_by: string | null;
                    synced_from_offline: boolean;
                    offline_hash: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['orders']['Insert']>;
            };
            inventory_items: {
                Row: {
                    id: string;
                    branch_id: string;
                    name: string;
                    sku: string | null;
                    quantity: number;
                    unit: string;
                    min_stock: number;
                    cost_price: number | null;
                    linked_menu_item_id: string | null;
                    category: InventoryCategory;
                    status: StockStatus;
                    last_synced_at: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['inventory_items']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['inventory_items']['Insert']>;
            };
        };
    };
}
