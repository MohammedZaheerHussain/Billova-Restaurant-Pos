// Print Service - Central printing management
// Handles print queuing, retries, and printer selection

import { PrinterDriver, PrinterInfo, PrintResult } from './drivers/printer-interface';
import { BrowserPrintDriver } from './drivers/browser-print';
import { USBPrintDriver } from './drivers/usb-print';
import { BluetoothPrintDriver } from './drivers/bluetooth-print';
import { NetworkPrintDriver } from './drivers/network-print';
import { ESCPOSEncoder } from './escpos/escpos-encoder';
import { logger } from '../utils/logger';

export type PrinterType = 'browser' | 'usb' | 'bluetooth' | 'network';

export interface PrintJob {
    id: string;
    type: 'receipt' | 'kot';
    data: Uint8Array | ESCPOSEncoder | string; // ESC/POS or HTML
    printerType: PrinterType;
    printerAddress?: string;
    retries: number;
    maxRetries: number;
    createdAt: Date;
    status: 'pending' | 'printing' | 'completed' | 'failed';
    error?: string;
}

interface PrintServiceConfig {
    maxRetries: number;
    retryDelay: number;
    defaultPrinter: PrinterType;
}

class PrintService {
    private config: PrintServiceConfig = {
        maxRetries: 3,
        retryDelay: 2000,
        defaultPrinter: 'browser',
    };

    private drivers: Map<PrinterType, PrinterDriver> = new Map();
    private queue: PrintJob[] = [];
    private isProcessing: boolean = false;
    private listeners: Set<(jobs: PrintJob[]) => void> = new Set();
    private savedPrinters: PrinterInfo[] = [];

    constructor() {
        // Initialize drivers
        this.drivers.set('browser', new BrowserPrintDriver());
        this.drivers.set('usb', new USBPrintDriver());
        this.drivers.set('bluetooth', new BluetoothPrintDriver());
        this.drivers.set('network', new NetworkPrintDriver());

        // Load saved printer preferences
        this.loadSavedPrinters();
    }

    // ==================== CONFIGURATION ====================

    setConfig(config: Partial<PrintServiceConfig>): void {
        this.config = { ...this.config, ...config };
    }

    setDefaultPrinter(type: PrinterType): void {
        this.config.defaultPrinter = type;
        localStorage.setItem('billova_default_printer', type);
    }

    getDefaultPrinter(): PrinterType {
        return this.config.defaultPrinter;
    }

    // ==================== PRINTER MANAGEMENT ====================

    /**
     * Connect to a printer
     */
    async connect(type: PrinterType, address?: string): Promise<boolean> {
        const driver = this.drivers.get(type);
        if (!driver) {
            logger.error(`[PrintService] Unknown printer type: ${type}`);
            return false;
        }

        const success = await driver.connect(address);
        if (success) {
            this.savePrinterPreference(type, address);
        }
        return success;
    }

    /**
     * Disconnect from a printer
     */
    async disconnect(type: PrinterType): Promise<void> {
        const driver = this.drivers.get(type);
        if (driver) {
            await driver.disconnect();
        }
    }

    /**
     * Check if a printer type is connected
     */
    isConnected(type: PrinterType): boolean {
        const driver = this.drivers.get(type);
        return driver?.isConnected() || false;
    }

    /**
     * Discover available printers
     */
    async discoverPrinters(): Promise<PrinterInfo[]> {
        const allPrinters: PrinterInfo[] = [];

        for (const [type, driver] of this.drivers) {
            if (driver.discover) {
                try {
                    const printers = await driver.discover();
                    allPrinters.push(...printers);
                } catch (error) {
                    logger.error(`[PrintService] Discovery failed for ${type}:`, error);
                }
            }
        }

        return allPrinters;
    }

    /**
     * Get supported printer capabilities
     */
    getCapabilities(): { type: PrinterType; supported: boolean; name: string }[] {
        return [
            {
                type: 'browser',
                supported: true,
                name: 'Browser Print (HTML)',
            },
            {
                type: 'usb',
                supported: USBPrintDriver.isSupported(),
                name: 'USB Thermal Printer',
            },
            {
                type: 'bluetooth',
                supported: BluetoothPrintDriver.isSupported(),
                name: 'Bluetooth Printer',
            },
            {
                type: 'network',
                supported: true,
                name: 'Network/WiFi Printer',
            },
        ];
    }

    // ==================== PRINTING ====================

    /**
     * Print ESC/POS data
     */
    async print(
        data: Uint8Array | ESCPOSEncoder,
        type: PrinterType = this.config.defaultPrinter,
        address?: string
    ): Promise<PrintResult> {
        const driver = this.drivers.get(type);
        if (!driver) {
            return { success: false, error: 'Invalid printer type' };
        }

        // Connect if not connected
        if (!driver.isConnected()) {
            const connected = await driver.connect(address);
            if (!connected) {
                return { success: false, error: 'Failed to connect to printer' };
            }
        }

        return await driver.print(data);
    }

    /**
     * Print HTML content (browser only)
     */
    async printHTML(html: string): Promise<PrintResult> {
        const browserDriver = this.drivers.get('browser') as BrowserPrintDriver;
        return await browserDriver.printHTML(html);
    }

    /**
     * Add a print job to the queue
     */
    queuePrint(
        data: Uint8Array | ESCPOSEncoder | string,
        options: {
            type?: 'receipt' | 'kot';
            printerType?: PrinterType;
            printerAddress?: string;
        } = {}
    ): string {
        const job: PrintJob = {
            id: `print-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: options.type || 'receipt',
            data,
            printerType: options.printerType || this.config.defaultPrinter,
            printerAddress: options.printerAddress,
            retries: 0,
            maxRetries: this.config.maxRetries,
            createdAt: new Date(),
            status: 'pending',
        };

        this.queue.push(job);
        this.notifyListeners();
        this.processQueue();

        return job.id;
    }

    /**
     * Get queue status
     */
    getQueue(): PrintJob[] {
        return [...this.queue];
    }

    /**
     * Clear completed/failed jobs from queue
     */
    clearCompletedJobs(): void {
        this.queue = this.queue.filter(job =>
            job.status === 'pending' || job.status === 'printing'
        );
        this.notifyListeners();
    }

    /**
     * Retry a failed job
     */
    retryJob(jobId: string): void {
        const job = this.queue.find(j => j.id === jobId);
        if (job && job.status === 'failed') {
            job.status = 'pending';
            job.retries = 0;
            job.error = undefined;
            this.notifyListeners();
            this.processQueue();
        }
    }

    /**
     * Remove a job from the queue
     */
    removeJob(jobId: string): void {
        this.queue = this.queue.filter(j => j.id !== jobId);
        this.notifyListeners();
    }

    // ==================== QUEUE PROCESSING ====================

    private async processQueue(): Promise<void> {
        if (this.isProcessing) return;

        const pendingJob = this.queue.find(j => j.status === 'pending');
        if (!pendingJob) return;

        this.isProcessing = true;
        pendingJob.status = 'printing';
        this.notifyListeners();

        try {
            let result: PrintResult;

            if (typeof pendingJob.data === 'string') {
                // HTML content
                result = await this.printHTML(pendingJob.data);
            } else {
                // ESC/POS data
                result = await this.print(
                    pendingJob.data,
                    pendingJob.printerType,
                    pendingJob.printerAddress
                );
            }

            if (result.success) {
                pendingJob.status = 'completed';
            } else {
                throw new Error(result.error || 'Print failed');
            }
        } catch (error) {
            pendingJob.retries++;
            pendingJob.error = error instanceof Error ? error.message : 'Unknown error';

            if (pendingJob.retries >= pendingJob.maxRetries) {
                pendingJob.status = 'failed';
            } else {
                pendingJob.status = 'pending';
                // Retry after delay
                setTimeout(() => this.processQueue(), this.config.retryDelay);
            }
        }

        this.notifyListeners();
        this.isProcessing = false;

        // Continue processing queue
        if (this.queue.some(j => j.status === 'pending')) {
            this.processQueue();
        }
    }

    // ==================== LISTENERS ====================

    subscribe(listener: (jobs: PrintJob[]) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        const jobs = this.getQueue();
        this.listeners.forEach(listener => listener(jobs));
    }

    // ==================== PERSISTENCE ====================

    private savePrinterPreference(type: PrinterType, address?: string): void {
        const printers = this.loadSavedPrinters();
        const existing = printers.findIndex(p => p.type === type);

        const printerInfo: PrinterInfo = {
            id: `${type}-${address || 'default'}`,
            name: type === 'network' ? `Network (${address})` : type,
            type,
            connected: true,
            address,
        };

        if (existing >= 0) {
            printers[existing] = printerInfo;
        } else {
            printers.push(printerInfo);
        }

        localStorage.setItem('billova_printers', JSON.stringify(printers));
        this.savedPrinters = printers;
    }

    private loadSavedPrinters(): PrinterInfo[] {
        try {
            const saved = localStorage.getItem('billova_printers');
            this.savedPrinters = saved ? JSON.parse(saved) : [];

            const defaultPrinter = localStorage.getItem('billova_default_printer');
            if (defaultPrinter) {
                this.config.defaultPrinter = defaultPrinter as PrinterType;
            }
        } catch {
            this.savedPrinters = [];
        }
        return this.savedPrinters;
    }

    getSavedPrinters(): PrinterInfo[] {
        return this.savedPrinters;
    }
}

// Singleton instance
export const printService = new PrintService();

export default printService;
