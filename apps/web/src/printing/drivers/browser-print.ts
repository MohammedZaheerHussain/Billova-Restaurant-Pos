// Browser Print Driver - Optimized for 3-Inch (80mm) Thermal POS Printers
// Supports: Multi-page Auto-Cut (Customer Bill + Kitchen KOT) & High-Contrast Black Output

import { BasePrinterDriver, PrintResult, PrinterInfo } from './printer-interface';
import { ESCPOSEncoder } from '../escpos/escpos-encoder';
import { logger } from '../../utils/logger';

export class BrowserPrintDriver extends BasePrinterDriver {
    readonly type = 'browser';
    readonly name = 'Browser Thermal Print';

    async connect(): Promise<boolean> {
        this.connected = true;
        return true;
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    async print(_data: Uint8Array | ESCPOSEncoder): Promise<PrintResult> {
        logger.warn('[BrowserPrint] ESC/POS data cannot be printed via browser. Use printHTML instead.');
        return {
            success: false,
            error: 'Use printHTML() for browser printing',
        };
    }

    /**
     * Print HTML content using browser's thermal print dialog
     */
    async printHTML(html: string, _options?: { silent?: boolean }): Promise<PrintResult> {
        try {
            // Create a hidden iframe for printing
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            iframe.style.left = '-9999px';
            iframe.style.top = '-9999px';

            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) {
                throw new Error('Cannot access iframe document');
            }

            // Write the complete 3-inch (80mm) thermal page
            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Billova Thermal Print</title>
                    <style>
                        @page {
                            margin: 0 !important;
                            size: 80mm auto;
                        }
                        * {
                            box-sizing: border-box;
                            margin: 0;
                            padding: 0;
                            color: #000000 !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #ffffff !important;
                            color: #000000 !important;
                            font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
                            width: 80mm;
                        }
                        @media print {
                            html, body {
                                width: 80mm !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            .customer-bill {
                                page-break-after: always !important;
                                break-after: page !important;
                            }
                            .thermal-cut-separator {
                                page-break-after: always !important;
                                break-after: page !important;
                            }
                            .kitchen-kot {
                                page-break-before: always !important;
                                break-before: page !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${html}
                </body>
                </html>
            `);
            iframeDoc.close();

            // Wait for DOM to render completely
            await new Promise(resolve => setTimeout(resolve, 250));

            // Trigger printer
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();

            // Remove iframe after user finishes print dialog
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 3000);

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Print failed',
            };
        }
    }

    async discover(): Promise<PrinterInfo[]> {
        return [{
            id: 'browser-default',
            name: 'Browser Default Thermal Printer',
            type: 'browser',
            connected: true,
        }];
    }
}

export default BrowserPrintDriver;
