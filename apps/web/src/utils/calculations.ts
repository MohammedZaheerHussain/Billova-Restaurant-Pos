// Billova POS - Centralized Billing, Financial Calculation & Reconciliation Utilities

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
    cgst: number;
    sgst: number;
    total: number;
    itemCount: number;
}

export interface CashReconciliationInput {
    openingFloat: number;
    cashSales: number;
    cashInflow: number;
    cashOutflow: number;
    cashExpenses: number;
    actualCountedCash: number;
}

export interface CashReconciliationResult {
    expectedCash: number;
    actualCash: number;
    discrepancy: number; // positive = over, negative = short, 0 = balanced
    isBalanced: boolean;
    status: 'BALANCED' | 'SHORTAGE' | 'OVERAGE';
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
 * Calculate CGST (50%) & SGST (50%) split for Indian GST billing
 */
export function calculateTaxSplit(gstAmount: number): { cgst: number; sgst: number } {
    if (gstAmount <= 0) return { cgst: 0, sgst: 0 };
    const half = Math.round((gstAmount / 2) * 100) / 100;
    const otherHalf = Math.round((gstAmount - half) * 100) / 100;
    return { cgst: half, sgst: otherHalf };
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
    const { cgst, sgst } = calculateTaxSplit(gstAmount);
    const total = Math.round((taxableSubtotal + gstAmount) * 100) / 100;
    const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    return {
        subtotal,
        discountAmount,
        taxableSubtotal,
        gstAmount,
        cgst,
        sgst,
        total,
        itemCount,
    };
}

/**
 * Reconcile End-of-Day / Shift Cash Drawer Ledger
 */
export function reconcileCashDrawer(input: CashReconciliationInput): CashReconciliationResult {
    const opening = Number(input.openingFloat) || 0;
    const sales = Number(input.cashSales) || 0;
    const inflow = Number(input.cashInflow) || 0;
    const outflow = Number(input.cashOutflow) || 0;
    const expenses = Number(input.cashExpenses) || 0;
    const actual = Number(input.actualCountedCash) || 0;

    const expectedCash = Math.round((opening + sales + inflow - outflow - expenses) * 100) / 100;
    const discrepancy = Math.round((actual - expectedCash) * 100) / 100;

    let status: 'BALANCED' | 'SHORTAGE' | 'OVERAGE' = 'BALANCED';
    if (discrepancy < -0.01) {
        status = 'SHORTAGE';
    } else if (discrepancy > 0.01) {
        status = 'OVERAGE';
    }

    return {
        expectedCash,
        actualCash: actual,
        discrepancy,
        isBalanced: status === 'BALANCED',
        status,
    };
}

/**
 * Generic CSV generator and browser downloader
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
    const escapeCell = (val: string | number) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvContent = [
        headers.map(escapeCell).join(','),
        ...rows.map(row => row.map(escapeCell).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename.replace(/\.csv$/i, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
