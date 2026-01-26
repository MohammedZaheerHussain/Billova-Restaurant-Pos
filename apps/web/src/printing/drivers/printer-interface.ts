// Printer Interface - Abstract interface for all printer drivers
import { ESCPOSEncoder } from '../escpos/escpos-encoder';

export interface PrinterInfo {
    id: string;
    name: string;
    type: 'usb' | 'bluetooth' | 'network' | 'browser';
    connected: boolean;
    address?: string;  // IP address or MAC address
}

export interface PrintResult {
    success: boolean;
    error?: string;
    printerId?: string;
}

export interface PrinterDriver {
    // Driver info
    readonly type: string;
    readonly name: string;

    // Connection
    connect(address?: string): Promise<boolean>;
    disconnect(): Promise<void>;
    isConnected(): boolean;

    // Printing
    print(data: Uint8Array | ESCPOSEncoder): Promise<PrintResult>;

    // Discovery (optional)
    discover?(): Promise<PrinterInfo[]>;
}

// Base class for printer drivers
export abstract class BasePrinterDriver implements PrinterDriver {
    abstract readonly type: string;
    abstract readonly name: string;

    protected connected: boolean = false;

    abstract connect(address?: string): Promise<boolean>;
    abstract disconnect(): Promise<void>;
    abstract print(data: Uint8Array | ESCPOSEncoder): Promise<PrintResult>;

    isConnected(): boolean {
        return this.connected;
    }

    protected getDataArray(data: Uint8Array | ESCPOSEncoder): Uint8Array {
        if (data instanceof ESCPOSEncoder) {
            return data.encode();
        }
        return data;
    }
}
