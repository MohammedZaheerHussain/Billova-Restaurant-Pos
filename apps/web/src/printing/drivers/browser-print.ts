// Browser Print Driver - Uses window.print() as fallback
// Works with any printer configured in the browser
import { BasePrinterDriver, PrintResult, PrinterInfo } from './printer-interface';
import { ESCPOSEncoder } from '../escpos/escpos-encoder';
import { logger } from '../../utils/logger';

export class BrowserPrintDriver extends BasePrinterDriver {
    readonly type = 'browser';
    readonly name = 'Browser Print';

    async connect(): Promise<boolean> {
        // Browser print is always "connected"
        this.connected = true;
        return true;
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    async print(_data: Uint8Array | ESCPOSEncoder): Promise<PrintResult> {
        // For browser printing, we don't use ESC/POS
        // Instead, we'll need HTML content
        logger.warn('[BrowserPrint] ESC/POS data cannot be printed via browser. Use printHTML instead.');
        return {
            success: false,
            error: 'Use printHTML() for browser printing',
        };
    }

    /**
     * Print HTML content using browser's print dialog
     */
    async printHTML(html: string, _options?: { silent?: boolean }): Promise<PrintResult> {
        try {
            // Create a hidden iframe for printing
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            iframe.style.left = '-9999px';

            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) {
                throw new Error('Cannot access iframe document');
            }

            // Write the HTML content
            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        @page {
                            margin: 0;
                            size: 80mm auto;
                        }
                        @media print {
                            body {
                                margin: 0;
                                padding: 10px;
                                font-family: 'Courier New', monospace;
                                font-size: 12px;
                                width: 80mm;
                            }
                        }
                        body {
                            margin: 0;
                            padding: 10px;
                            font-family: 'Courier New', monospace;
                            font-size: 12px;
                        }
                    </style>
                </head>
                <body>
                    ${html}
                </body>
                </html>
            `);
            iframeDoc.close();

            // Wait for content to load
            await new Promise(resolve => setTimeout(resolve, 100));

            // Print
            iframe.contentWindow?.print();

            // Remove iframe after printing
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);

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
            name: 'Browser Default Printer',
            type: 'browser',
            connected: true,
        }];
    }
}

export default BrowserPrintDriver;
