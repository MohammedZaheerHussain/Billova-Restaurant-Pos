// Billova POS - Centralized Billing & Financial Calculation Utilities

export interface CalculationItem {
    unitPrice: number;
    quantity: number;
    hasGST?: boolean;
    gstPercent?: number;
}

export interface CalculationInput {
    items: CalculationItem[];
    discountType?: 'PERCENTAGE' | 'FIXED' | null;
    discountValue?: number;
    defaultGstPercent?: number;
}

export interface CalculationResult {
    subtotal: number;
    discountAmount: number;
    taxableSubtotal: number;
    gstAmount: number;
    total: number;
    itemCount: number;
}

/**
 * Calculate Subtotal from cart/order items
 */
export function calculateSubtotal(items: CalculationItem[]): number {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
        const itemPrice = Number(item.unitPrice) || 0;
        const itemQty = Number(item.quantity) || 0;
        return sum + (itemPrice * itemQty);
    }, 0);
}

/**
 * Calculate Discount Amount based on subtotal and discount configuration
 */
export function calculateDiscount(subtotal: number, discountType?: 'PERCENTAGE' | 'FIXED' | null, discountValue?: number): number {
    const val = Number(discountValue) || 0;
    if (!discountType || val <= 0 || subtotal <= 0) return 0;

    if (discountType === 'PERCENTAGE') {
        const percentage = Math.min(Math.max(val, 0), 100);
        return Math.round((subtotal * (percentage / 100)) * 100) / 100;
    }

    return Math.min(val, subtotal);
}

/**
 * Calculate GST tax amount
 */
export function calculateGST(taxableAmount: number, gstPercent: number = 5): number {
    if (taxableAmount <= 0 || gstPercent <= 0) return 0;
    return Math.round((taxableAmount * (gstPercent / 100)) * 100) / 100;
}

/**
 * Compute complete Order Financial Totals accurately
 */
export function calculateOrderTotals(input: CalculationInput): CalculationResult {
    const items = input.items || [];
    const subtotal = calculateSubtotal(items);
    const discountAmount = calculateDiscount(subtotal, input.discountType, input.discountValue);
    const taxableSubtotal = Math.max(0, subtotal - discountAmount);

    // Default GST rate (e.g. 5% standard for Indian restaurants)
    const effectiveGstPercent = input.defaultGstPercent !== undefined ? input.defaultGstPercent : 5;
    const gstAmount = calculateGST(taxableSubtotal, effectiveGstPercent);
    const total = Math.round((taxableSubtotal + gstAmount) * 100) / 100;
    const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    return {
        subtotal,
        discountAmount,
        taxableSubtotal,
        gstAmount,
        total,
        itemCount,
    };
}
