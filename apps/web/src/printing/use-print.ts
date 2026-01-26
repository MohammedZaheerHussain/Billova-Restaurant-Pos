// React hook for print service integration
import { useState, useEffect, useCallback } from 'react';
import printService, { PrintJob, PrinterType } from './print-service';
import { PrinterInfo } from './drivers/printer-interface';
import { ESCPOSEncoder } from './escpos/escpos-encoder';

/**
 * Hook for managing print jobs and queue
 */
export function usePrintQueue() {
    const [queue, setQueue] = useState<PrintJob[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        // Subscribe to queue updates
        const unsubscribe = printService.subscribe((jobs) => {
            setQueue(jobs);
            setIsProcessing(jobs.some(j => j.status === 'printing'));
        });

        // Get initial queue
        setQueue(printService.getQueue());

        return unsubscribe;
    }, []);

    const queuePrint = useCallback((
        data: Uint8Array | ESCPOSEncoder | string,
        options?: {
            type?: 'receipt' | 'kot';
            printerType?: PrinterType;
            printerAddress?: string;
        }
    ) => {
        return printService.queuePrint(data, options);
    }, []);

    const retryJob = useCallback((jobId: string) => {
        printService.retryJob(jobId);
    }, []);

    const removeJob = useCallback((jobId: string) => {
        printService.removeJob(jobId);
    }, []);

    const clearCompleted = useCallback(() => {
        printService.clearCompletedJobs();
    }, []);

    const pendingCount = queue.filter(j => j.status === 'pending').length;
    const failedCount = queue.filter(j => j.status === 'failed').length;

    return {
        queue,
        isProcessing,
        pendingCount,
        failedCount,
        queuePrint,
        retryJob,
        removeJob,
        clearCompleted,
    };
}

/**
 * Hook for printer management
 */
export function usePrinters() {
    const [printers, setPrinters] = useState<PrinterInfo[]>([]);
    const [capabilities, setCapabilities] = useState(printService.getCapabilities());
    const [defaultPrinter, setDefaultPrinter] = useState<PrinterType>(printService.getDefaultPrinter());
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        // Load saved printers
        setPrinters(printService.getSavedPrinters());
        setCapabilities(printService.getCapabilities());
    }, []);

    const connect = useCallback(async (type: PrinterType, address?: string): Promise<boolean> => {
        setIsConnecting(true);
        try {
            const success = await printService.connect(type, address);
            if (success) {
                setPrinters(printService.getSavedPrinters());
            }
            return success;
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(async (type: PrinterType) => {
        await printService.disconnect(type);
        setPrinters(printService.getSavedPrinters());
    }, []);

    const discover = useCallback(async () => {
        return await printService.discoverPrinters();
    }, []);

    const setDefault = useCallback((type: PrinterType) => {
        printService.setDefaultPrinter(type);
        setDefaultPrinter(type);
    }, []);

    const isConnected = useCallback((type: PrinterType) => {
        return printService.isConnected(type);
    }, []);

    return {
        printers,
        capabilities,
        defaultPrinter,
        isConnecting,
        connect,
        disconnect,
        discover,
        setDefault,
        isConnected,
    };
}

/**
 * Simple print function hook
 */
export function usePrint() {
    const { queuePrint: queueFromHook } = usePrintQueue();

    const print = useCallback(async (
        data: Uint8Array | ESCPOSEncoder | string,
        options?: {
            type?: 'receipt' | 'kot';
            printerType?: PrinterType;
        }
    ): Promise<string> => {
        return queueFromHook(data, options);
    }, [queueFromHook]);

    const printDirect = useCallback(async (
        data: Uint8Array | ESCPOSEncoder,
        type?: PrinterType
    ) => {
        return await printService.print(data, type);
    }, []);

    const printHTML = useCallback(async (html: string) => {
        return await printService.printHTML(html);
    }, []);

    return {
        print,
        printDirect,
        printHTML,
    };
}

export default usePrint;
