// Printing Module - Main exports

// ESC/POS Encoder
export {
    ESCPOSEncoder,
    TextAlign,
    FontSize,
    CutType,
    createEncoder58mm,
    createEncoder80mm,
} from './escpos/escpos-encoder';

// Print Drivers
export type { PrinterDriver, PrinterInfo, PrintResult } from './drivers/printer-interface';
export { BrowserPrintDriver } from './drivers/browser-print';
export { USBPrintDriver } from './drivers/usb-print';
export { BluetoothPrintDriver } from './drivers/bluetooth-print';
export { NetworkPrintDriver } from './drivers/network-print';

// Templates
export { generateReceipt, generateReceiptHTML } from './templates/receipt-template';
export type { ReceiptData, ReceiptItem } from './templates/receipt-template';
export { generateKOT, generateKOTHTML } from './templates/kot-template';
export type { KOTData, KOTItem } from './templates/kot-template';

// Print Service
export { printService } from './print-service';
export type { PrintJob, PrinterType } from './print-service';

// Printer Configuration Store
export { usePrinterConfigStore } from './printer-config-store';
export type { PrinterConfig, PrintSettings, PrinterLogo, PrintJobType } from './printer-config-store';

// Print Utilities
export {
    autoPrintKOT,
    autoPrintBill,
    reprintReceipt,
    reprintKOT,
    printTestPage,
    openCashDrawer,
} from './print-utils';

// React Hooks
export { usePrintQueue, usePrinters, usePrint } from './use-print';
