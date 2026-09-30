import { describe, it, expect } from 'vitest';
import {
    calculateOrderTotals,
    calculateSubtotal,
    calculateDiscount,
    calculateGST,
    calculateTaxSplit,
    reconcileCashDrawer,
} from '../utils/calculations';

describe('Financial Reconciliation & Indian GST Tax Audit Tests', () => {
    describe('Subtotal and Item Pricing Calculations', () => {
        it('handles empty item lists gracefully', () => {
            expect(calculateSubtotal([])).toBe(0);
        });

        it('calculates multiple line items with custom quantities accurately', () => {
            const items = [
                { unitPrice: 350.5, quantity: 3 }, // 1051.50
                { unitPrice: 120.0, quantity: 2 }, // 240.00
                { unitPrice: 45.75, quantity: 4 }, // 183.00
            ];
            expect(calculateSubtotal(items)).toBe(1474.5);
        });

        it('ignores NaN and invalid price/quantity entries safely', () => {
            const items = [
                { unitPrice: 'invalid' as any, quantity: 2 },
                { unitPrice: 100, quantity: 'none' as any },
                { unitPrice: 250, quantity: 2 },
            ];
            expect(calculateSubtotal(items)).toBe(500);
        });
    });

    describe('Discount Boundary & Cap Validations', () => {
        it('calculates percentage discounts accurately', () => {
            expect(calculateDiscount(1200, 'PERCENTAGE', 15)).toBe(180);
        });

        it('caps percentage discount at 100%', () => {
            expect(calculateDiscount(800, 'PERCENTAGE', 150)).toBe(800);
        });

        it('caps fixed discount at subtotal (prevents negative bill values)', () => {
            expect(calculateDiscount(500, 'FIXED', 750)).toBe(500);
        });

        it('handles 0% or negative discount input defensively', () => {
            expect(calculateDiscount(500, 'PERCENTAGE', -10)).toBe(0);
            expect(calculateDiscount(500, 'FIXED', 0)).toBe(0);
            expect(calculateDiscount(500, null, 50)).toBe(0);
        });
    });

    describe('GST Tax Calculation & CGST/SGST Split', () => {
        it('computes standard 5% restaurant GST', () => {
            expect(calculateGST(1000, 5)).toBe(50);
        });

        it('computes 18% standard service tax', () => {
            expect(calculateGST(1000, 18)).toBe(180);
        });

        it('splits GST equally between CGST (50%) and SGST (50%) with 2-decimal rounding', () => {
            const { cgst, sgst } = calculateTaxSplit(45.5);
            expect(cgst).toBe(22.75);
            expect(sgst).toBe(22.75);
            expect(cgst + sgst).toBe(45.5);
        });

        it('handles odd decimal tax splits without losing single paise', () => {
            const { cgst, sgst } = calculateTaxSplit(33.33);
            expect(cgst + sgst).toBeCloseTo(33.33, 2);
        });

        it('returns zero tax for zero taxable amount', () => {
            const { cgst, sgst } = calculateTaxSplit(0);
            expect(cgst).toBe(0);
            expect(sgst).toBe(0);
        });
    });

    describe('End-to-End Order Totals Validation', () => {
        it('computes a complete standard order flow', () => {
            const result = calculateOrderTotals({
                items: [
                    { unitPrice: 220, quantity: 2 }, // 440
                    { unitPrice: 180, quantity: 1 }, // 180 (Subtotal = 620)
                ],
                discountType: 'PERCENTAGE',
                discountValue: 10, // 62
                defaultGstPercent: 5, // Taxable = 558, GST 5% = 27.90
            });

            expect(result.subtotal).toBe(620);
            expect(result.discountAmount).toBe(62);
            expect(result.taxableSubtotal).toBe(558);
            expect(result.gstAmount).toBe(27.9);
            expect(result.cgst).toBe(13.95);
            expect(result.sgst).toBe(13.95);
            expect(result.total).toBe(585.9);
            expect(result.itemCount).toBe(3);
        });

        it('handles 100% complimentary orders with zero tax liability', () => {
            const result = calculateOrderTotals({
                items: [{ unitPrice: 500, quantity: 2 }],
                discountType: 'PERCENTAGE',
                discountValue: 100,
                defaultGstPercent: 5,
            });

            expect(result.subtotal).toBe(1000);
            expect(result.discountAmount).toBe(1000);
            expect(result.taxableSubtotal).toBe(0);
            expect(result.gstAmount).toBe(0);
            expect(result.total).toBe(0);
        });
    });

    describe('Cash Till & Drawer Reconciliation Audit', () => {
        it('validates a perfectly balanced cash drawer', () => {
            const result = reconcileCashDrawer({
                openingFloat: 2000,
                cashSales: 15450,
                cashInflow: 500,  // e.g. added change
                cashOutflow: 1000, // e.g. safe drop
                cashExpenses: 450, // e.g. petty cash expense
                actualCountedCash: 16500,
            });

            // Expected = 2000 + 15450 + 500 - 1000 - 450 = 16500
            expect(result.expectedCash).toBe(16500);
            expect(result.actualCash).toBe(16500);
            expect(result.discrepancy).toBe(0);
            expect(result.isBalanced).toBe(true);
            expect(result.status).toBe('BALANCED');
        });

        it('detects a cash drawer shortage accurately', () => {
            const result = reconcileCashDrawer({
                openingFloat: 1000,
                cashSales: 5000,
                cashInflow: 0,
                cashOutflow: 0,
                cashExpenses: 200,
                actualCountedCash: 5700, // Expected = 5800 -> Shortage of ₹100
            });

            expect(result.expectedCash).toBe(5800);
            expect(result.discrepancy).toBe(-100);
            expect(result.isBalanced).toBe(false);
            expect(result.status).toBe('SHORTAGE');
        });

        it('detects a cash drawer overage accurately', () => {
            const result = reconcileCashDrawer({
                openingFloat: 1000,
                cashSales: 5000,
                cashInflow: 0,
                cashOutflow: 0,
                cashExpenses: 0,
                actualCountedCash: 6050, // Expected = 6000 -> Overage of ₹50
            });

            expect(result.expectedCash).toBe(6000);
            expect(result.discrepancy).toBe(50);
            expect(result.isBalanced).toBe(false);
            expect(result.status).toBe('OVERAGE');
        });
    });
});
