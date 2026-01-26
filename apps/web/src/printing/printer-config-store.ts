// Printer Configuration Store - Manages printer settings and routing
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PrinterType } from './print-service';

export type PrintJobType = 'bill' | 'kot' | 'bar' | 'report';

export interface PrinterConfig {
    id: string;
    name: string;
    type: PrinterType;
    address?: string;        // IP:Port for network, or device ID
    paperWidth: 80 | 58;     // mm
    isDefault: boolean;
    isActive: boolean;
    jobTypes: PrintJobType[]; // What kind of jobs this printer handles
    copies: number;          // Number of copies to print
    autoCut: boolean;
    openCashDrawer: boolean; // For bill printers
    beepOnPrint: boolean;    // For KOT printers
    createdAt: Date;
    lastUsed?: Date;
}

export interface PrinterLogo {
    enabled: boolean;
    imageData?: string;      // Base64 encoded image
    width: number;           // Logo width in pixels (max 384 for 80mm)
    alignment: 'left' | 'center' | 'right';
}

export interface PrintSettings {
    // Auto-print settings
    autoPrintKOT: boolean;
    autoPrintBill: boolean;

    // Order settings
    dailyOrderReset: boolean; // Reset order numbers at midnight
    orderResetTime: string;   // Time to reset (HH:mm format, default "00:00")

    // Receipt settings
    showGSTBreakdown: boolean;
    showFSSAI: boolean;
    printQRCode: boolean;
    upiId?: string;
    footerText: string;

    // KOT settings
    kotShowItemPrice: boolean;
    kotLargeFont: boolean;
    kotBeepCount: number;

    // Logo settings
    logo: PrinterLogo;

    // Sound settings
    playPrintSound: boolean;
}

interface PrinterConfigState {
    // Printers
    printers: PrinterConfig[];

    // Global settings
    settings: PrintSettings;

    // Actions - Printers
    addPrinter: (printer: Omit<PrinterConfig, 'id' | 'createdAt'>) => string;
    updatePrinter: (id: string, updates: Partial<PrinterConfig>) => void;
    removePrinter: (id: string) => void;
    setDefaultPrinter: (id: string) => void;

    // Actions - Get Printers
    getPrinterForJob: (jobType: PrintJobType) => PrinterConfig | null;
    getPrintersForJob: (jobType: PrintJobType) => PrinterConfig[];
    getDefaultPrinter: () => PrinterConfig | null;

    // Actions - Settings
    updateSettings: (updates: Partial<PrintSettings>) => void;
    updateLogo: (logo: Partial<PrinterLogo>) => void;

    // Actions - Mark usage
    markPrinterUsed: (id: string) => void;
}

const defaultSettings: PrintSettings = {
    autoPrintKOT: true,
    autoPrintBill: false,
    dailyOrderReset: true,  // Enable by default
    orderResetTime: '00:00',
    showGSTBreakdown: true,
    showFSSAI: true,
    printQRCode: false,
    footerText: 'Thank you for your visit!\nPlease come again',
    kotShowItemPrice: false,
    kotLargeFont: true,
    kotBeepCount: 2,
    logo: {
        enabled: false,
        width: 200,
        alignment: 'center',
    },
    playPrintSound: true,
};

export const usePrinterConfigStore = create<PrinterConfigState>()(
    persist(
        (set, get) => ({
            printers: [],
            settings: defaultSettings,

            // Add a new printer
            addPrinter: (printer) => {
                const id = `printer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const newPrinter: PrinterConfig = {
                    ...printer,
                    id,
                    createdAt: new Date(),
                };

                set((state) => ({
                    printers: [...state.printers, newPrinter],
                }));

                return id;
            },

            // Update printer
            updatePrinter: (id, updates) => {
                set((state) => ({
                    printers: state.printers.map((p) =>
                        p.id === id ? { ...p, ...updates } : p
                    ),
                }));
            },

            // Remove printer
            removePrinter: (id) => {
                set((state) => ({
                    printers: state.printers.filter((p) => p.id !== id),
                }));
            },

            // Set default printer
            setDefaultPrinter: (id) => {
                set((state) => ({
                    printers: state.printers.map((p) => ({
                        ...p,
                        isDefault: p.id === id,
                    })),
                }));
            },

            // Get printer for a specific job type
            getPrinterForJob: (jobType) => {
                const { printers } = get();
                // First, find an active printer that handles this job type
                const matchingPrinter = printers.find(
                    (p) => p.isActive && p.jobTypes.includes(jobType)
                );
                if (matchingPrinter) return matchingPrinter;

                // Fallback to default printer
                const defaultPrinter = printers.find((p) => p.isDefault && p.isActive);
                return defaultPrinter || null;
            },

            // Get all printers for a job type (for multi-copy scenarios)
            getPrintersForJob: (jobType) => {
                const { printers } = get();
                return printers.filter(
                    (p) => p.isActive && p.jobTypes.includes(jobType)
                );
            },

            // Get default printer
            getDefaultPrinter: () => {
                const { printers } = get();
                return printers.find((p) => p.isDefault && p.isActive) || null;
            },

            // Update global settings
            updateSettings: (updates) => {
                set((state) => ({
                    settings: { ...state.settings, ...updates },
                }));
            },

            // Update logo settings
            updateLogo: (logoUpdates) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        logo: { ...state.settings.logo, ...logoUpdates },
                    },
                }));
            },

            // Mark printer as recently used
            markPrinterUsed: (id) => {
                set((state) => ({
                    printers: state.printers.map((p) =>
                        p.id === id ? { ...p, lastUsed: new Date() } : p
                    ),
                }));
            },
        }),
        {
            name: 'billova-printer-config',
            // Custom serialization for dates
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name);
                    if (!str) return null;
                    const data = JSON.parse(str);
                    // Convert date strings back to Date objects
                    if (data.state?.printers) {
                        data.state.printers = data.state.printers.map((p: any) => ({
                            ...p,
                            createdAt: new Date(p.createdAt),
                            lastUsed: p.lastUsed ? new Date(p.lastUsed) : undefined,
                        }));
                    }
                    return data;
                },
                setItem: (name, value) => {
                    localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => {
                    localStorage.removeItem(name);
                },
            },
        }
    )
);

export default usePrinterConfigStore;
