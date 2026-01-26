// Print Preview Modal - Shows receipt/KOT preview before printing
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Eye } from 'lucide-react';
import { generateReceiptHTML, ReceiptData } from '../../printing/templates/receipt-template';
import { generateKOTHTML, KOTData } from '../../printing/templates/kot-template';
import './PrintPreview.css';

interface PrintPreviewProps {
    type: 'receipt' | 'kot';
    data: ReceiptData | KOTData;
    isOpen: boolean;
    onClose: () => void;
    onPrint: () => void;
    isPrinting?: boolean;
}

export function PrintPreview({
    type,
    data,
    isOpen,
    onClose,
    onPrint,
    isPrinting = false,
}: PrintPreviewProps) {
    const [scale, setScale] = useState(1);

    // Generate HTML preview
    const previewHTML = type === 'receipt'
        ? generateReceiptHTML(data as ReceiptData)
        : generateKOTHTML(data as KOTData);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="print-preview-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="print-preview-modal"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="preview-header">
                            <div className="preview-title">
                                <Eye size={20} />
                                <h3>Print Preview</h3>
                                <span className="preview-type">
                                    {type === 'receipt' ? 'Receipt/Bill' : 'Kitchen Order Ticket'}
                                </span>
                            </div>
                            <button className="close-btn" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="preview-controls">
                            <span>Zoom: {Math.round(scale * 100)}%</span>
                            <input
                                type="range"
                                min="0.5"
                                max="1.5"
                                step="0.1"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                            />
                        </div>

                        <div className="preview-container">
                            <div
                                className="preview-content"
                                style={{ transform: `scale(${scale})` }}
                                dangerouslySetInnerHTML={{ __html: previewHTML }}
                            />
                        </div>

                        <div className="preview-footer">
                            <button className="cancel-btn" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="print-btn"
                                onClick={onPrint}
                                disabled={isPrinting}
                            >
                                <Printer size={18} />
                                {isPrinting ? 'Printing...' : 'Print'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Quick preview hook
export function usePrintPreview() {
    const [previewState, setPreviewState] = useState<{
        isOpen: boolean;
        type: 'receipt' | 'kot';
        data: ReceiptData | KOTData | null;
        onPrint: (() => void) | null;
    }>({
        isOpen: false,
        type: 'receipt',
        data: null,
        onPrint: null,
    });

    const showPreview = (
        type: 'receipt' | 'kot',
        data: ReceiptData | KOTData,
        onPrint: () => void
    ) => {
        setPreviewState({
            isOpen: true,
            type,
            data,
            onPrint,
        });
    };

    const hidePreview = () => {
        setPreviewState((prev) => ({ ...prev, isOpen: false }));
    };

    return {
        showPreview,
        hidePreview,
        PreviewModal: previewState.data ? (
            <PrintPreview
                type={previewState.type}
                data={previewState.data}
                isOpen={previewState.isOpen}
                onClose={hidePreview}
                onPrint={() => {
                    previewState.onPrint?.();
                    hidePreview();
                }}
            />
        ) : null,
    };
}

export default PrintPreview;
