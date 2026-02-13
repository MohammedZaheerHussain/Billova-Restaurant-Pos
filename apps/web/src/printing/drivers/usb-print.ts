// USB Print Driver - For USB thermal printers using WebUSB API
// Supports: Epson, Star, Bixolon, and other USB ESC/POS printers
import { BasePrinterDriver, PrintResult, PrinterInfo } from './printer-interface';
import { ESCPOSEncoder } from '../escpos/escpos-encoder';
import { logger } from '../../utils/logger';

// Known USB Vendor IDs for thermal printers
const KNOWN_VENDORS: Record<number, string> = {
    0x04B8: 'Epson',
    0x0519: 'Star Micronics',
    0x1504: 'Bixolon',
    0x0DD4: 'Custom',
    0x0FE6: 'Citizen',
    0x0483: 'STMicroelectronics (Generic)',
    0x1A86: 'QinHeng CH340 (Generic)',
    0x067B: 'Prolific (USB-Serial)',
};

export class USBPrintDriver extends BasePrinterDriver {
    readonly type = 'usb';
    readonly name = 'USB Printer';

    private device: USBDevice | null = null;
    private endpointOut: number = 1;  // Default OUT endpoint

    /**
     * Check if WebUSB is supported
     */
    static isSupported(): boolean {
        return 'usb' in navigator;
    }

    /**
     * Connect to a USB printer
     * Will show browser's USB device picker
     */
    async connect(): Promise<boolean> {
        if (!USBPrintDriver.isSupported()) {
            logger.error('[USBPrint] WebUSB not supported in this browser');
            return false;
        }

        try {
            // Request device with known vendor filters
            const filters: USBDeviceFilter[] = Object.keys(KNOWN_VENDORS).map(vendor => ({
                vendorId: parseInt(vendor),
            }));

            // Add generic printer class filter
            filters.push({ classCode: 7 }); // Printer class

            this.device = await navigator.usb.requestDevice({ filters });

            if (!this.device) {
                return false;
            }

            await this.device.open();

            // Select configuration and claim interface
            if (this.device.configuration === null) {
                await this.device.selectConfiguration(1);
            }

            const iface = this.device.configuration?.interfaces[0];
            if (iface) {
                await this.device.claimInterface(iface.interfaceNumber);

                // Find OUT endpoint for printing
                const endpoint = iface.alternate.endpoints.find(
                    ep => ep.direction === 'out' && ep.type === 'bulk'
                );

                if (endpoint) {
                    this.endpointOut = endpoint.endpointNumber;
                }
            }

            this.connected = true;
            logger.debug(`[USBPrint] Connected to ${this.device.productName || 'Unknown device'}`);
            return true;
        } catch (error) {
            logger.error('[USBPrint] Connection failed:', error);
            this.connected = false;
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.device) {
            try {
                await this.device.close();
            } catch (error) {
                logger.error('[USBPrint] Disconnect error:', error);
            }
            this.device = null;
        }
        this.connected = false;
    }

    async print(data: Uint8Array | ESCPOSEncoder): Promise<PrintResult> {
        if (!this.device || !this.connected) {
            return {
                success: false,
                error: 'Printer not connected',
            };
        }

        try {
            const printData = this.getDataArray(data);

            // Send data in chunks (max 64KB per transfer)
            const chunkSize = 65536;
            for (let i = 0; i < printData.length; i += chunkSize) {
                const chunk = printData.slice(i, i + chunkSize);
                await this.device.transferOut(this.endpointOut, chunk);
            }

            return {
                success: true,
                printerId: this.device.serialNumber || this.device.productName || undefined,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'USB print failed',
            };
        }
    }

    /**
     * Get list of already-authorized USB printers
     */
    async discover(): Promise<PrinterInfo[]> {
        if (!USBPrintDriver.isSupported()) {
            return [];
        }

        try {
            const devices = await navigator.usb.getDevices();
            return devices
                .filter(device => {
                    const vendorId = device.vendorId;
                    return vendorId in KNOWN_VENDORS || device.deviceClass === 7;
                })
                .map(device => ({
                    id: device.serialNumber || `usb-${device.vendorId}-${device.productId}`,
                    name: device.productName || KNOWN_VENDORS[device.vendorId] || 'USB Printer',
                    type: 'usb' as const,
                    connected: device.opened,
                    address: `${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
                }));
        } catch (error) {
            logger.error('[USBPrint] Discovery failed:', error);
            return [];
        }
    }

    /**
     * Get current device info
     */
    getDeviceInfo(): PrinterInfo | null {
        if (!this.device) return null;

        return {
            id: this.device.serialNumber || `usb-${this.device.vendorId}-${this.device.productId}`,
            name: this.device.productName || KNOWN_VENDORS[this.device.vendorId] || 'USB Printer',
            type: 'usb',
            connected: this.connected,
            address: `${this.device.vendorId.toString(16)}:${this.device.productId.toString(16)}`,
        };
    }
}

export default USBPrintDriver;
