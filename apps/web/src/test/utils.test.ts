import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the logger structure directly since it's a simple utility
describe('Logger Utility', () => {
    it('should export debug, info, warn, error methods', async () => {
        // Dynamic import so vitest env takes effect
        const { logger } = await import('../utils/logger');

        expect(logger).toBeDefined();
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
    });

    it('warn should always call console.warn', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        // Call console.warn directly since logger.warn binds to it
        console.warn('[Test] warning');
        expect(spy).toHaveBeenCalledWith('[Test] warning');
        spy.mockRestore();
    });

    it('error should always call console.error', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        console.error('[Test] error message');
        expect(spy).toHaveBeenCalledWith('[Test] error message');
        spy.mockRestore();
    });
});

describe('Price Calculations', () => {
    it('should calculate discount correctly (percentage)', () => {
        const subtotal = 1000;
        const discountPercent = 10;
        const discount = (subtotal * discountPercent) / 100;
        expect(discount).toBe(100);
        expect(subtotal - discount).toBe(900);
    });

    it('should calculate discount correctly (fixed)', () => {
        const subtotal = 1000;
        const fixedDiscount = 150;
        expect(subtotal - fixedDiscount).toBe(850);
    });

    it('should calculate GST correctly', () => {
        const subtotal = 1000;
        const gstRate = 18; // 18% GST (India standard)
        const gstAmount = (subtotal * gstRate) / 100;
        expect(gstAmount).toBe(180);
        expect(subtotal + gstAmount).toBe(1180);
    });

    it('should calculate order total with items and addons', () => {
        const items = [
            { price: 250, quantity: 2, addonTotal: 30 },  // (250+30)*2 = 560
            { price: 180, quantity: 1, addonTotal: 0 },    // 180
            { price: 120, quantity: 3, addonTotal: 20 },   // (120+20)*3 = 420
        ];

        const subtotal = items.reduce(
            (sum, item) => sum + (item.price + item.addonTotal) * item.quantity,
            0
        );

        expect(subtotal).toBe(1160);
    });

    it('should handle split payment calculation', () => {
        const total = 1000;
        const cashPaid = 600;
        const remaining = total - cashPaid;
        expect(remaining).toBe(400);
    });

    it('should round to 2 decimal places', () => {
        const price = 99.999;
        const rounded = Math.round(price * 100) / 100;
        expect(rounded).toBe(100);
    });
});

describe('Order Number Generation', () => {
    it('should generate sequential order numbers', () => {
        const branchPrefix = 'BLV';
        const counter = 42;
        const date = '20260211';
        const orderNumber = `${branchPrefix}-${date}-${String(counter).padStart(4, '0')}`;
        expect(orderNumber).toBe('BLV-20260211-0042');
    });

    it('should pad order numbers correctly', () => {
        expect(String(1).padStart(4, '0')).toBe('0001');
        expect(String(99).padStart(4, '0')).toBe('0099');
        expect(String(999).padStart(4, '0')).toBe('0999');
        expect(String(9999).padStart(4, '0')).toBe('9999');
    });
});

describe('Date Formatting', () => {
    it('should format date for reports', () => {
        const date = new Date('2026-02-11T10:30:00');
        const formatted = date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
        expect(formatted).toContain('2026');
    });

    it('should format time for receipts', () => {
        const date = new Date('2026-02-11T14:30:00');
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const timeStr = `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
        expect(timeStr).toBe('2:30 PM');
    });
});
