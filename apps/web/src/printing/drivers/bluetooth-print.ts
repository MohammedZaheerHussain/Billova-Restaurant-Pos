// Bluetooth Print Driver - For Bluetooth thermal printers
// Supports: Portable BT printers like RPP02N, PT-210, etc.
import { BasePrinterDriver, PrintResult, PrinterInfo } from './printer-interface';
import { ESCPOSEncoder } from '../escpos/escpos-encoder';

// Extend Navigator interface for Web Bluetooth
declare global {
    interface Navigator {
        bluetooth: Bluetooth;
    }
}

// Common BLE printer service UUIDs
const PRINTER_SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb',  // Common printer service
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // TI Serial Port
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // Some Chinese printers
];

export class BluetoothPrintDriver extends BasePrinterDriver {
    readonly type = 'bluetooth';
    readonly name = 'Bluetooth Printer';

    private device: BluetoothDevice | null = null;
    private server: BluetoothRemoteGATTServer | null = null;
    private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

    /**
     * Check if Web Bluetooth is supported
     */
    static isSupported(): boolean {
        return 'bluetooth' in navigator;
    }

    /**
     * Connect to a Bluetooth printer
     * Will show browser's Bluetooth device picker
     */
    async connect(): Promise<boolean> {
        if (!BluetoothPrintDriver.isSupported()) {
            console.error('[BluetoothPrint] Web Bluetooth not supported');
            return false;
        }

        try {
            // Request device with printer filters
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'PT' },      // Portable thermal printers
                    { namePrefix: 'RPP' },     // RPP series
                    { namePrefix: 'MTP' },     // Mobile thermal printers
                    { namePrefix: 'BT' },      // Generic BT printers
                    { namePrefix: 'Printer' }, // Named "Printer"
                ],
                optionalServices: PRINTER_SERVICE_UUIDS,
            });

            if (!this.device) {
                return false;
            }

            // Connect to GATT server
            this.server = await this.device.gatt?.connect() ?? null;

            if (!this.server) {
                throw new Error('Failed to connect to GATT server');
            }

            // Find printer service and characteristic
            for (const serviceUUID of PRINTER_SERVICE_UUIDS) {
                try {
                    const service = await this.server.getPrimaryService(serviceUUID);
                    const characteristics = await service.getCharacteristics();

                    // Find writable characteristic
                    this.characteristic = characteristics.find(
                        c => c.properties.write || c.properties.writeWithoutResponse
                    ) ?? null;

                    if (this.characteristic) {
                        break;
                    }
                } catch {
                    // Service not found, try next
                    continue;
                }
            }

            if (!this.characteristic) {
                // Try to get any writable characteristic
                const services = await this.server.getPrimaryServices();
                for (const service of services) {
                    const chars = await service.getCharacteristics();
                    this.characteristic = chars.find(
                        c => c.properties.write || c.properties.writeWithoutResponse
                    ) ?? null;
                    if (this.characteristic) break;
                }
            }

            if (!this.characteristic) {
                throw new Error('No writable characteristic found');
            }

            // Set up disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                this.connected = false;
                console.log('[BluetoothPrint] Device disconnected');
            });

            this.connected = true;
            console.log(`[BluetoothPrint] Connected to ${this.device.name || 'Unknown device'}`);
            return true;
        } catch (error) {
            console.error('[BluetoothPrint] Connection failed:', error);
            this.connected = false;
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.server?.connected) {
            this.server.disconnect();
        }
        this.device = null;
        this.server = null;
        this.characteristic = null;
        this.connected = false;
    }

    async print(data: Uint8Array | ESCPOSEncoder): Promise<PrintResult> {
        if (!this.characteristic || !this.connected) {
            return {
                success: false,
                error: 'Printer not connected',
            };
        }

        try {
            const printData = this.getDataArray(data);

            // BLE has MTU limits, send in chunks (typical MTU = 20 bytes for older devices)
            const chunkSize = 20;
            for (let i = 0; i < printData.length; i += chunkSize) {
                const chunk = printData.slice(i, i + chunkSize);

                if (this.characteristic.properties.writeWithoutResponse) {
                    await this.characteristic.writeValueWithoutResponse(chunk);
                } else {
                    await this.characteristic.writeValue(chunk);
                }

                // Small delay between chunks
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            return {
                success: true,
                printerId: this.device?.name || undefined,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Bluetooth print failed',
            };
        }
    }

    /**
     * Get info about connected device
     */
    getDeviceInfo(): PrinterInfo | null {
        if (!this.device) return null;

        return {
            id: this.device.id,
            name: this.device.name || 'Bluetooth Printer',
            type: 'bluetooth',
            connected: this.connected,
        };
    }
}

export default BluetoothPrintDriver;
