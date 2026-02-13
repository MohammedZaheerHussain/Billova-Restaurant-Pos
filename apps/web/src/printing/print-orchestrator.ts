// Print Orchestrator - Central print coordination for Billova POS
// Step 2 of Phase 2: Hardware Integration
// 
// This is the HEART of the printing system. All print jobs should flow through here.
// 
// Responsibilities:
// - Route print jobs to correct printer
// - Apply templates (Receipt vs KOT)
// - Handle double-print logic (Customer + Kitchen)
// - Manage print queue with retry logic
// - Silent failure mode (never block billing)
// - Track print history

import { printService } from './print-service';
import { usePrinterConfigStore, PrinterConfig, PrintJobType } from './printer-config-store';
import { generateReceipt, ReceiptData } from './templates/receipt-template';
import { generateKOT, KOTData } from './templates/kot-template';
import { ESCPOSEncoder, CutType } from './escpos/escpos-encoder';
import { db, PrintHistoryEntry } from '../db/indexed-db';
import { logger } from '../utils/logger';

// ==================== CONFIGURATION ====================

const PRINT_CONFIG = {
    TIMEOUT_MS: 3000,       // 3 second timeout
    MAX_RETRIES: 1,         // 1 retry on failure
    RETRY_DELAY_MS: 500,    // 500ms between retries
    SILENT_FAILURE: true,   // Never block billing on print failure
};

// ==================== TYPES ====================

export interface PrintResult {
    success: boolean;
    printerId?: string;
    error?: string;
    timestamp: Date;
}


export interface OrderPrintData {
    // Order identification
    orderId: string;
    orderLocalId?: string;
    orderNumber?: number;
    billNumber: string;

    // Business info
    businessName: string;
    branchName?: string;
    address?: string;
    phone?: string;
    gstNumber?: string;
    fssaiNumber?: string;

    // Order details
    items: {
        name: string;
        quantity: number;
        unitPrice: number;
        total: number;
        variant?: string;
        addons?: string[];
        notes?: string;
        isVeg?: boolean;
    }[];

    // Table/Customer info
    tableId?: string;
    tableName?: string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';
    customerName?: string;
    customerPhone?: string;

    // Pricing
    subtotal: number;
    discountAmount?: number;
    sgst?: number;
    cgst?: number;
    gstAmount: number;
    total: number;

    // Payment
    paymentMode?: string;
    amountPaid?: number;
    changeGiven?: number;

    // Metadata
    orderDate: Date;
    cashierName?: string;
    kotNumber?: number;
}

// ==================== PRINT ORCHESTRATOR CLASS ====================

class PrintOrchestrator {
    private lastPrintedOrder: OrderPrintData | null = null;
    private printHistory: PrintHistoryEntry[] = [];
    private deviceId: string = '';

    /**
     * Initialize orchestrator with device ID
     */
    initialize(deviceId: string): void {
        this.deviceId = deviceId;
        logger.debug('[PrintOrchestrator] Initialized with device:', deviceId);
    }

    /**
     * Print customer receipt
     * Called after successful payment
     */
    async printCustomerReceipt(order: OrderPrintData): Promise<PrintResult> {
        const store = usePrinterConfigStore.getState();
        const printer = store.getPrinterForJob('bill');

        if (!printer) {
            logger.warn('[PrintOrchestrator] No bill printer configured');
            return this.createFailureResult('No bill printer configured');
        }

        try {
            // Build receipt data
            const receiptData: ReceiptData = {
                businessName: order.businessName,
                branchName: order.branchName,
                address: order.address,
                phone: order.phone,
                gstNumber: store.settings.showGSTBreakdown ? order.gstNumber : undefined,
                fssaiNumber: store.settings.showFSSAI ? order.fssaiNumber : undefined,
                billNumber: order.billNumber,
                orderNumber: order.orderNumber,
                tableName: order.tableName,
                orderType: order.orderType,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                items: order.items,
                subtotal: order.subtotal,
                discountAmount: order.discountAmount ?? 0,
                sgst: store.settings.showGSTBreakdown ? order.sgst : undefined,
                cgst: store.settings.showGSTBreakdown ? order.cgst : undefined,
                gstAmount: order.gstAmount,
                total: order.total,
                paymentMode: order.paymentMode,
                amountPaid: order.amountPaid,
                changeGiven: order.changeGiven,
                orderDate: order.orderDate,
                cashierName: order.cashierName,
                footerText: store.settings.footerText,
                printQR: store.settings.printQRCode,
                upiId: store.settings.upiId,
            };

            // Generate receipt
            const encoder = generateReceipt(receiptData, printer.paperWidth === 80 ? 48 : 32);

            // Apply cut if enabled
            if (printer.autoCut) {
                encoder.cut(CutType.PARTIAL);
            }

            // Open cash drawer if enabled
            if (printer.openCashDrawer) {
                encoder.openCashDrawer();
            }

            // Print with timeout and retry
            const result = await this.printWithRetry(encoder, printer, 'bill');

            // Store for reprint
            if (result.success) {
                this.lastPrintedOrder = order;
            }

            // Log to history
            await this.logPrintHistory({
                orderId: order.orderId,
                orderLocalId: order.orderLocalId,
                printType: 'bill',
                printerName: printer.name,
                printerId: printer.id,
                status: result.success ? 'success' : 'failed',
                error: result.error,
                printedAt: new Date(),
                deviceId: this.deviceId,
            });

            return result;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[PrintOrchestrator] Bill print error:', error);
            return this.createFailureResult(errorMsg);
        }
    }

    /**
     * Print kitchen order ticket (KOT)
     * Called on order creation or on demand
     */
    async printKitchenTicket(order: OrderPrintData): Promise<PrintResult> {
        const store = usePrinterConfigStore.getState();
        const printer = store.getPrinterForJob('kot');

        if (!printer) {
            logger.warn('[PrintOrchestrator] No KOT printer configured');
            return this.createFailureResult('No KOT printer configured');
        }

        try {
            // Build KOT data (NO PRICES!)
            const kotData: KOTData = {
                kotNumber: order.kotNumber ?? order.orderNumber ?? 0,
                orderNumber: order.orderNumber,
                billNumber: order.billNumber,
                tableName: order.tableName,
                orderType: order.orderType,
                items: order.items.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    variant: item.variant,
                    addons: item.addons,
                    notes: item.notes,
                    isVeg: item.isVeg,
                })),
                createdAt: order.orderDate,
                serverName: order.cashierName,
                orderNotes: undefined, // Can be added later
            };

            // Generate KOT
            const encoder = generateKOT(kotData, printer.paperWidth === 80 ? 48 : 32);

            // Apply cut if enabled
            if (printer.autoCut) {
                encoder.cut(CutType.PARTIAL);
            }

            // Beep if enabled
            if (printer.beepOnPrint) {
                const beepCount = store.settings.kotBeepCount || 2;
                encoder.beep(beepCount, 100);
            }

            // Print with timeout and retry
            const result = await this.printWithRetry(encoder, printer, 'kot');

            // Log to history
            await this.logPrintHistory({
                orderId: order.orderId,
                orderLocalId: order.orderLocalId,
                printType: 'kot',
                printerName: printer.name,
                printerId: printer.id,
                status: result.success ? 'success' : 'failed',
                error: result.error,
                printedAt: new Date(),
                deviceId: this.deviceId,
            });

            return result;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[PrintOrchestrator] KOT print error:', error);
            return this.createFailureResult(errorMsg);
        }
    }

    /**
     * Print order - handles double-print logic
     * Customer Receipt + Kitchen Ticket (if enabled)
     */
    async printOrder(order: OrderPrintData, options: {
        printReceipt?: boolean;
        printKOT?: boolean;
    } = {}): Promise<{ receipt: PrintResult | null; kot: PrintResult | null }> {
        const store = usePrinterConfigStore.getState();

        const shouldPrintReceipt = options.printReceipt ?? store.settings.autoPrintBill;
        const shouldPrintKOT = options.printKOT ?? store.settings.autoPrintKOT;

        const results: { receipt: PrintResult | null; kot: PrintResult | null } = {
            receipt: null,
            kot: null,
        };

        // Print customer receipt
        if (shouldPrintReceipt) {
            results.receipt = await this.printCustomerReceipt(order);
        }

        // Print kitchen ticket
        if (shouldPrintKOT) {
            results.kot = await this.printKitchenTicket(order);
        }

        return results;
    }

    /**
     * Reprint last bill
     */
    async reprintLastBill(): Promise<PrintResult> {
        if (!this.lastPrintedOrder) {
            return this.createFailureResult('No previous order to reprint');
        }

        logger.debug('[PrintOrchestrator] Reprinting last bill');
        const result = await this.printCustomerReceipt(this.lastPrintedOrder);

        // Log as reprint
        if (result.success) {
            await this.logPrintHistory({
                orderId: this.lastPrintedOrder.orderId,
                orderLocalId: this.lastPrintedOrder.orderLocalId,
                printType: 'reprint',
                printerName: 'Last Bill Printer',
                printerId: result.printerId || '',
                status: 'success',
                printedAt: new Date(),
                deviceId: this.deviceId,
            });
        }

        return result;
    }

    /**
     * Reprint by order ID
     * Fetches order from IndexedDB and reprints
     */
    async reprintByOrderId(orderId: string): Promise<PrintResult> {
        try {
            // Try to find order in offline storage
            const order = await db.offlineOrders
                .where('localId')
                .equals(orderId)
                .or('serverId')
                .equals(orderId)
                .first();

            if (!order) {
                return this.createFailureResult('Order not found');
            }

            // Convert to print data
            const printData: OrderPrintData = {
                orderId: order.serverId || order.localId,
                orderLocalId: order.localId,
                billNumber: order.serverBillNumber || order.tempBillNumber,
                businessName: 'Billova POS', // Should come from branch settings
                items: order.items.map((item: any) => ({
                    name: item.menuItemName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    variant: item.variantName,
                    notes: item.notes,
                })),
                tableId: order.tableId,
                tableName: order.tableName,
                orderType: order.orderType,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                subtotal: order.subtotal,
                discountAmount: order.discountAmount,
                gstAmount: order.gstAmount,
                total: order.total,
                orderDate: order.createdAt,
            };

            logger.debug('[PrintOrchestrator] Reprinting order:', orderId);
            return await this.printCustomerReceipt(printData);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[PrintOrchestrator] Reprint error:', error);
            return this.createFailureResult(errorMsg);
        }
    }

    /**
     * Print with timeout and retry logic
     * CRITICAL: Never blocks the UI, fails silently if configured
     */
    private async printWithRetry(
        encoder: ESCPOSEncoder,
        printer: PrinterConfig,
        _jobType: PrintJobType
    ): Promise<PrintResult> {
        let lastError = '';

        for (let attempt = 0; attempt <= PRINT_CONFIG.MAX_RETRIES; attempt++) {
            try {
                // Create timeout promise
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Print timeout')), PRINT_CONFIG.TIMEOUT_MS);
                });

                // Race between print and timeout
                const result = await Promise.race([
                    printService.print(encoder, printer.type, printer.address),
                    timeoutPromise,
                ]);

                if (result.success) {
                    // Mark printer as used
                    usePrinterConfigStore.getState().markPrinterUsed(printer.id);

                    return {
                        success: true,
                        printerId: printer.id,
                        timestamp: new Date(),
                    };
                }

                lastError = result.error || 'Print failed';
            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';
                logger.warn(`[PrintOrchestrator] Attempt ${attempt + 1} failed:`, lastError);
            }

            // Wait before retry
            if (attempt < PRINT_CONFIG.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, PRINT_CONFIG.RETRY_DELAY_MS));
            }
        }

        // All attempts failed
        logger.error('[PrintOrchestrator] All print attempts failed:', lastError);

        return {
            success: false,
            error: lastError,
            timestamp: new Date(),
        };
    }

    /**
     * Create a failure result
     */
    private createFailureResult(error: string): PrintResult {
        return {
            success: false,
            error,
            timestamp: new Date(),
        };
    }

    /**
     * Log print to history (stored in IndexedDB)
     */
    private async logPrintHistory(entry: PrintHistoryEntry): Promise<void> {
        try {
            // Keep in-memory for quick access
            this.printHistory.unshift(entry);
            if (this.printHistory.length > 100) {
                this.printHistory = this.printHistory.slice(0, 100);
            }

            // Persist to IndexedDB
            await db.printHistory.add(entry);

            // Keep only last 500 entries in IndexedDB
            const count = await db.printHistory.count();
            if (count > 500) {
                const oldest = await db.printHistory.orderBy('printedAt').limit(count - 500).primaryKeys();
                await db.printHistory.bulkDelete(oldest);
            }
        } catch (error) {
            logger.error('[PrintOrchestrator] Failed to log print history:', error);
        }
    }

    /**
     * Get recent print history (from IndexedDB if available, else memory)
     */
    async getRecentPrintHistory(limit: number = 20): Promise<PrintHistoryEntry[]> {
        try {
            return await db.printHistory
                .orderBy('printedAt')
                .reverse()
                .limit(limit)
                .toArray();
        } catch {
            return this.printHistory.slice(0, limit);
        }
    }

    /**
     * Check if any printer is configured
     */
    hasPrinterConfigured(): boolean {
        const store = usePrinterConfigStore.getState();
        return store.printers.length > 0;
    }

    /**
     * Get printer status summary
     */
    getPrinterStatus(): {
        billPrinter: PrinterConfig | null;
        kotPrinter: PrinterConfig | null;
        hasAnyPrinter: boolean;
    } {
        const store = usePrinterConfigStore.getState();
        return {
            billPrinter: store.getPrinterForJob('bill'),
            kotPrinter: store.getPrinterForJob('kot'),
            hasAnyPrinter: store.printers.length > 0,
        };
    }
}

// ==================== SINGLETON & EXPORTS ====================

export const printOrchestrator = new PrintOrchestrator();

export default printOrchestrator;
