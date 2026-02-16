// Network Print Driver - For network/WiFi thermal printers
// Supports: Epson TM-T88, Star TSP100, and other TCP/IP printers
import { BasePrinterDriver, PrintResult, PrinterInfo } from './printer-interface';
import { ESCPOSEncoder } from '../escpos/escpos-encoder';
import { logger } from '../../utils/logger';

export interface NetworkPrinterConfig {
    host: string;
    port: number;
    timeout?: number;
}

export class NetworkPrintDriver extends BasePrinterDriver {
    readonly type = 'network';
    readonly name = 'Network Printer';

    private config: NetworkPrinterConfig | null = null;
    private printServerUrl: string = '/api/v1/print';  // Backend proxy endpoint

    /**
     * Connect to a network printer
     * Note: Direct TCP connections aren't possible from browsers
     * We use a backend proxy to forward print data
     */
    async connect(address?: string): Promise<boolean> {
        if (!address) {
            logger.error('[NetworkPrint] No address provided');
            return false;
        }

        try {
            // Parse address (format: "host:port" or just "host")
            const [host, portStr] = address.split(':');
            const port = portStr ? parseInt(portStr, 10) : 9100;  // Default ESC/POS port

            this.config = {
                host,
                port,
                timeout: 5000,
            };

            // Test connection via backend
            const response = await fetch(`${this.printServerUrl}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, port }),
            });

            if (response.ok) {
                this.connected = true;
                logger.debug(`[NetworkPrint] Connected to ${host}:${port}`);
                return true;
            }

            this.connected = false;
            return false;
        } catch (error) {
            logger.error('[NetworkPrint] Connection failed:', error);
            this.connected = false;
            return false;
        }
    }

    async disconnect(): Promise<void> {
        this.config = null;
        this.connected = false;
    }

    async print(data: Uint8Array | ESCPOSEncoder): Promise<PrintResult> {
        if (!this.config || !this.connected) {
            return {
                success: false,
                error: 'Printer not connected',
            };
        }

        try {
            const printData = this.getDataArray(data);

            // Convert to base64 for JSON transport
            let binary = '';
            for (let i = 0; i < printData.length; i++) {
                binary += String.fromCharCode(printData[i]);
            }
            const base64Data = btoa(binary);

            const response = await fetch(this.printServerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: this.config.host,
                    port: this.config.port,
                    data: base64Data,
                }),
            });

            if (response.ok) {
                return { success: true, printerId: `${this.config.host}:${this.config.port}` };
            }

            const error = await response.text();
            return { success: false, error };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network print failed',
            };
        }
    }

    /**
     * Discover printers on local network
     * Note: This requires backend support for network scanning
     */
    async discover(): Promise<PrinterInfo[]> {
        try {
            const response = await fetch(`${this.printServerUrl}/discover`);
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            logger.error('[NetworkPrint] Discovery failed:', error);
            return [];
        }
    }

    /**
     * Set custom print server URL (if not using default /api/v1/print)
     */
    setPrintServerUrl(url: string): void {
        this.printServerUrl = url;
    }
}

export default NetworkPrintDriver;
