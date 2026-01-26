// Order Complete Modal - Shows after payment with print, WhatsApp, and new order options
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Printer, MessageCircle, Plus, Loader2, X } from 'lucide-react';
import { usePrinterConfigStore } from '../../printing/printer-config-store';
import { reprintReceipt, ReceiptData } from '../../printing';
import './OrderCompleteModal.css';

export interface OrderCompleteData {
    orderId: string;
    orderNumber: number;
    billNumber: string;
    total: number;
    customerName?: string;
    customerPhone?: string;
    receiptData: ReceiptData;
}

interface OrderCompleteModalProps {
    isOpen: boolean;
    orderData: OrderCompleteData | null;
    onClose: () => void;
    onNewOrder: () => void;
}

type ModalStep = 'complete' | 'printing' | 'whatsapp' | 'done';

export function OrderCompleteModal({
    isOpen,
    orderData,
    onClose,
    onNewOrder,
}: OrderCompleteModalProps) {
    const { settings } = usePrinterConfigStore();
    const [currentStep, setCurrentStep] = useState<ModalStep>('complete');
    const [isPrinting, setIsPrinting] = useState(false);
    const [printSuccess, setPrintSuccess] = useState(false);

    // Determine if WhatsApp share should be shown
    const hasCustomerPhone = Boolean(orderData?.customerPhone && orderData?.customerName);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentStep('complete');
            setPrintSuccess(false);
            setIsPrinting(false);

            // If auto-print is enabled, print immediately
            if (settings.autoPrintBill && orderData) {
                handlePrint();
            }
        }
    }, [isOpen, orderData]);

    const handlePrint = async () => {
        if (!orderData) return;

        setIsPrinting(true);
        try {
            const success = await reprintReceipt(orderData.receiptData);
            setPrintSuccess(success);

            if (success) {
                // Move to next step after successful print
                if (hasCustomerPhone) {
                    setCurrentStep('whatsapp');
                } else {
                    setCurrentStep('done');
                }
            }
        } catch (error) {
            console.error('Print failed:', error);
            setPrintSuccess(false);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleWhatsAppShare = () => {
        if (!orderData || !orderData.customerPhone) return;

        const message = generateWhatsAppMessage(orderData);
        const phoneNumber = formatPhoneNumber(orderData.customerPhone);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
        setCurrentStep('done');
    };

    const handleNewOrder = () => {
        onNewOrder();
        onClose();
    };

    const handleSkipWhatsApp = () => {
        setCurrentStep('done');
    };

    if (!orderData) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="order-complete-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        className="order-complete-modal"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        {/* Close button - only show in done step */}
                        {currentStep === 'done' && (
                            <button className="modal-close-btn" onClick={handleNewOrder}>
                                <X size={20} />
                            </button>
                        )}

                        {/* Success Checkmark */}
                        <motion.div
                            className="success-icon"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.1 }}
                        >
                            <Check size={48} strokeWidth={3} />
                        </motion.div>

                        {/* Title */}
                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            Order Complete!
                        </motion.h2>

                        {/* Order Badge */}
                        <motion.div
                            className="order-badge"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            Order #{orderData.orderNumber}
                        </motion.div>

                        {/* Total Amount */}
                        <motion.div
                            className="total-amount"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            Total: <span className="amount">₹{orderData.total.toFixed(2)}</span>
                        </motion.div>

                        {/* Customer Info (if available) */}
                        {hasCustomerPhone && (
                            <motion.div
                                className="customer-info"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                {orderData.customerName} • {orderData.customerPhone}
                            </motion.div>
                        )}

                        {/* Action Buttons based on step */}
                        <motion.div
                            className="action-buttons"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            {/* Step 1: Complete - Show Print Bill and New Order */}
                            {(currentStep === 'complete' && !settings.autoPrintBill) && (
                                <div className="complete-buttons">
                                    <button
                                        className="btn-print"
                                        onClick={handlePrint}
                                        disabled={isPrinting}
                                    >
                                        {isPrinting ? (
                                            <>
                                                <Loader2 size={20} className="spin" />
                                                Printing...
                                            </>
                                        ) : (
                                            <>
                                                <Printer size={20} />
                                                Print Bill
                                            </>
                                        )}
                                    </button>
                                    <button
                                        className="btn-new-order-secondary"
                                        onClick={handleNewOrder}
                                        disabled={isPrinting}
                                    >
                                        <Plus size={20} />
                                        New Order
                                    </button>
                                </div>
                            )}

                            {/* Auto-printing indicator */}
                            {(currentStep === 'complete' && settings.autoPrintBill && isPrinting) && (
                                <div className="auto-print-status">
                                    <Loader2 size={24} className="spin" />
                                    <span>Printing bill...</span>
                                </div>
                            )}

                            {/* Step 2: WhatsApp (only if customer phone exists) */}
                            {currentStep === 'whatsapp' && (
                                <>
                                    <button className="btn-whatsapp" onClick={handleWhatsAppShare}>
                                        <MessageCircle size={20} />
                                        Share Bill via WhatsApp
                                    </button>
                                    <button className="btn-skip" onClick={handleSkipWhatsApp}>
                                        Skip
                                    </button>
                                </>
                            )}

                            {/* Step 3: Done - New Order */}
                            {currentStep === 'done' && (
                                <button className="btn-new-order" onClick={handleNewOrder}>
                                    <Plus size={20} />
                                    New Order
                                </button>
                            )}

                            {/* Print button shown after auto-print or if user wants to print again */}
                            {currentStep !== 'complete' && !isPrinting && (
                                <button
                                    className="btn-reprint"
                                    onClick={handlePrint}
                                    disabled={isPrinting}
                                >
                                    <Printer size={16} />
                                    {printSuccess ? 'Print Again' : 'Print Bill'}
                                </button>
                            )}
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate WhatsApp message for bill sharing
 */
function generateWhatsAppMessage(orderData: OrderCompleteData): string {
    const { receiptData } = orderData;
    const lines: string[] = [];

    // Header
    lines.push('🧾 *' + receiptData.businessName + '*');
    if (receiptData.branchName) {
        lines.push(receiptData.branchName);
    }
    lines.push('');

    // Order Info
    lines.push(`📋 Bill No: *${orderData.billNumber}*`);
    lines.push(`📅 Date: ${new Date(receiptData.orderDate).toLocaleDateString('en-IN')}`);
    lines.push(`⏰ Time: ${new Date(receiptData.orderDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    lines.push('');

    // Items
    lines.push('━━━━━━━━━━━━━━━━');
    for (const item of receiptData.items) {
        let itemLine = `${item.quantity}x ${item.name}`;
        if (item.variant) {
            itemLine += ` (${item.variant})`;
        }
        itemLine += ` - ₹${item.total.toFixed(2)}`;
        lines.push(itemLine);
    }
    lines.push('━━━━━━━━━━━━━━━━');
    lines.push('');

    // Totals
    lines.push(`Subtotal: ₹${receiptData.subtotal.toFixed(2)}`);

    if (receiptData.discountAmount > 0) {
        lines.push(`Discount: -₹${receiptData.discountAmount.toFixed(2)}`);
    }

    if (receiptData.gstAmount > 0) {
        lines.push(`GST: ₹${receiptData.gstAmount.toFixed(2)}`);
    }

    lines.push('');
    lines.push(`💰 *TOTAL: ₹${orderData.total.toFixed(2)}*`);
    lines.push('');

    // Footer
    lines.push('Thank you for your visit! 🙏');
    lines.push('_Powered by Billova_');

    return lines.join('\n');
}

/**
 * Format phone number for WhatsApp API
 * Adds India country code if not present
 */
function formatPhoneNumber(phone: string): string {
    // Remove spaces, dashes, and other characters
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // If starts with 0, remove it
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // If 10 digits (India), add 91
    if (cleaned.length === 10 && !cleaned.startsWith('91')) {
        cleaned = '91' + cleaned;
    }

    // If doesn't start with +, add +
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }

    return cleaned;
}

export default OrderCompleteModal;
