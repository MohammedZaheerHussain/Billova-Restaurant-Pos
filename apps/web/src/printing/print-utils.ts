// Print Utilities - Auto-print and reprint functionality
import { printService, PrinterType } from './print-service';
import { usePrinterConfigStore } from './printer-config-store';
import { generateReceipt, ReceiptData, generateReceiptHTML } from './templates/receipt-template';
import { generateKOT, KOTData, generateKOTHTML } from './templates/kot-template';
import { ESCPOSEncoder, TextAlign } from './escpos/escpos-encoder';
import { logger } from '../utils/logger';

// ==================== AUTO-PRINT FUNCTIONS ====================

/**
 * Auto-print KOT when an order is created
 * Called from order creation flow
 */
export async function autoPrintKOT(kotData: KOTData): Promise<boolean> {
    const store = usePrinterConfigStore.getState();

    if (!store.settings.autoPrintKOT) {
        logger.debug('[AutoPrint] KOT auto-print disabled');
        return false;
    }

    const printers = store.getPrintersForJob('kot');

    if (printers.length === 0) {
        logger.warn('[AutoPrint] No printers configured for KOT');
        return false;
    }

    let success = true;

    for (const printer of printers) {
        try {
            const encoder = generateKOT(kotData, printer.paperWidth === 80 ? 48 : 32);

            // Print multiple copies if configured
            for (let i = 0; i < (printer.copies || 1); i++) {
                const result = await printService.print(
                    encoder,
                    printer.type,
                    printer.address
                );

                if (!result.success) {
                    logger.error(`[AutoPrint] KOT print failed for ${printer.name}:`, result.error);
                    success = false;
                }
            }

            // Play sound if enabled
            if (store.settings.playPrintSound) {
                playPrintSound();
            }

            store.markPrinterUsed(printer.id);
        } catch (error) {
            logger.error(`[AutoPrint] KOT print error for ${printer.name}:`, error);
            success = false;
        }
    }

    return success;
}

/**
 * Auto-print Bill when payment is completed
 * Called from payment flow
 */
export async function autoPrintBill(receiptData: ReceiptData): Promise<boolean> {
    const store = usePrinterConfigStore.getState();

    if (!store.settings.autoPrintBill) {
        logger.debug('[AutoPrint] Bill auto-print disabled');
        return false;
    }

    const printer = store.getPrinterForJob('bill');

    if (!printer) {
        logger.warn('[AutoPrint] No printer configured for bills');
        return false;
    }

    try {
        // Logo handling can be added here if needed
        const encoder = generateReceipt(receiptData, printer.paperWidth === 80 ? 48 : 32);

        // Print
        for (let i = 0; i < (printer.copies || 1); i++) {
            const result = await printService.print(
                encoder,
                printer.type,
                printer.address
            );

            if (!result.success) {
                logger.error('[AutoPrint] Bill print failed:', result.error);
                return false;
            }
        }

        // Play sound if enabled
        if (store.settings.playPrintSound) {
            playPrintSound();
        }

        store.markPrinterUsed(printer.id);
        return true;
    } catch (error) {
        logger.error('[AutoPrint] Bill print error:', error);
        return false;
    }
}

// ==================== REPRINT FUNCTIONS ====================

export interface ReprintOptions {
    showPreview?: boolean;
    printerType?: PrinterType;
    copies?: number;
}

/**
 * Reprint a receipt/bill
 */
export async function reprintReceipt(
    receiptData: ReceiptData,
    options: ReprintOptions = {}
): Promise<boolean> {
    const store = usePrinterConfigStore.getState();

    const printer = store.getPrinterForJob('bill');
    const printerType = options.printerType || printer?.type || 'browser';
    const printerAddress = printer?.address;
    const copies = options.copies || 1;

    try {
        if (printerType === 'browser') {
            // Use HTML for browser printing
            const html = generateReceiptHTML(receiptData);
            const result = await printService.printHTML(html);
            return result.success;
        }

        const encoder = generateReceipt(receiptData, printer?.paperWidth === 80 ? 48 : 32);

        for (let i = 0; i < copies; i++) {
            const result = await printService.print(encoder, printerType, printerAddress);
            if (!result.success) {
                logger.error('[Reprint] Receipt print failed:', result.error);
                return false;
            }
        }

        if (store.settings.playPrintSound) {
            playPrintSound();
        }

        return true;
    } catch (error) {
        logger.error('[Reprint] Receipt error:', error);
        return false;
    }
}

/**
 * Reprint a KOT
 */
export async function reprintKOT(
    kotData: KOTData,
    options: ReprintOptions = {}
): Promise<boolean> {
    const store = usePrinterConfigStore.getState();

    const printer = store.getPrinterForJob('kot');
    const printerType = options.printerType || printer?.type || 'browser';
    const printerAddress = printer?.address;
    const copies = options.copies || 1;

    try {
        if (printerType === 'browser') {
            const html = generateKOTHTML(kotData);
            const result = await printService.printHTML(html);
            return result.success;
        }

        const encoder = generateKOT(kotData, printer?.paperWidth === 80 ? 48 : 32);

        for (let i = 0; i < copies; i++) {
            const result = await printService.print(encoder, printerType, printerAddress);
            if (!result.success) {
                logger.error('[Reprint] KOT print failed:', result.error);
                return false;
            }
        }

        if (store.settings.playPrintSound) {
            playPrintSound();
        }

        return true;
    } catch (error) {
        logger.error('[Reprint] KOT error:', error);
        return false;
    }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Play print notification sound
 */
function playPrintSound() {
    try {
        // Use Web Audio API for cross-browser support
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);

        // Second beep
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.type = 'sine';
            osc2.frequency.value = 1000;
            gain2.gain.value = 0.1;
            osc2.start();
            osc2.stop(audioContext.currentTime + 0.1);
        }, 150);
    } catch (error) {
        // Fallback: do nothing if audio is not available
        console.debug('[PrintSound] Audio not available');
    }
}

/**
 * Print a test page
 */
export async function printTestPage(printerType: PrinterType, address?: string): Promise<boolean> {
    const encoder = new ESCPOSEncoder({ width: 48 });

    encoder.initialize();
    encoder.align(TextAlign.CENTER);
    encoder.bold(true);
    encoder.line('=== TEST PRINT ===');
    encoder.bold(false);
    encoder.feed(1);
    encoder.line('Billova POS System');
    encoder.line('Test Print Successful!');
    encoder.feed(1);
    encoder.line(new Date().toLocaleString('en-IN'));
    encoder.feed(2);
    encoder.line('If you can read this,');
    encoder.line('your printer is working!');
    encoder.feed(3);

    const result = await printService.print(encoder, printerType, address);
    return result.success;
}

/**
 * Open cash drawer
 */
export async function openCashDrawer(): Promise<boolean> {
    const store = usePrinterConfigStore.getState();
    const printer = store.getPrinterForJob('bill');

    if (!printer) {
        logger.warn('[CashDrawer] No bill printer configured');
        return false;
    }

    if (!printer.openCashDrawer) {
        logger.debug('[CashDrawer] Cash drawer command disabled for this printer');
        return false;
    }

    const encoder = new ESCPOSEncoder();
    encoder.initialize().openCashDrawer();

    const result = await printService.print(encoder, printer.type, printer.address);
    return result.success;
}

export default {
    autoPrintKOT,
    autoPrintBill,
    reprintReceipt,
    reprintKOT,
    printTestPage,
    openCashDrawer,
};
