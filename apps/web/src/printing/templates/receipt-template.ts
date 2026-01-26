// Receipt/Bill Template Generator
// Creates formatted receipts for thermal printers

import { ESCPOSEncoder, TextAlign, FontSize, CutType } from '../escpos/escpos-encoder';

export interface ReceiptItem {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    variant?: string;
    addons?: string[];
    notes?: string;
}

export interface ReceiptData {
    // Business Info
    businessName: string;
    branchName?: string;
    address?: string;
    phone?: string;
    email?: string;
    gstNumber?: string;
    fssaiNumber?: string;

    // Order Info
    billNumber: string;
    orderNumber?: number;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';
    tableName?: string;
    customerName?: string;
    customerPhone?: string;

    // Items
    items: ReceiptItem[];

    // Amounts
    subtotal: number;
    discountType?: 'PERCENTAGE' | 'FIXED' | null;
    discountValue?: number;
    discountAmount: number;
    sgst?: number;
    cgst?: number;
    gstAmount: number;
    total: number;

    // Payment
    paymentMode?: string;
    amountPaid?: number;
    changeGiven?: number;

    // Timestamps
    orderDate: Date;
    cashierName?: string;

    // Footer
    footerText?: string;
    printQR?: boolean;
    upiId?: string;
}

export function generateReceipt(data: ReceiptData, printerWidth: 48 | 32 = 48): ESCPOSEncoder {
    const encoder = new ESCPOSEncoder({ width: printerWidth });
    const rupee = encoder.rupee.bind(encoder);

    encoder.initialize();

    // ==================== HEADER ====================
    encoder.align(TextAlign.CENTER);

    // Business name (large)
    encoder.setFontSize(FontSize.DOUBLE_BOTH).bold(true);
    encoder.line(data.businessName.toUpperCase());
    encoder.setFontSize(FontSize.NORMAL).bold(false);

    // Branch name
    if (data.branchName) {
        encoder.line(data.branchName);
    }

    // Address
    if (data.address) {
        encoder.line(data.address);
    }

    // Contact
    if (data.phone) {
        encoder.line(`Tel: ${data.phone}`);
    }

    // GST Number
    if (data.gstNumber) {
        encoder.line(`GSTIN: ${data.gstNumber}`);
    }

    // FSSAI
    if (data.fssaiNumber) {
        encoder.line(`FSSAI: ${data.fssaiNumber}`);
    }

    encoder.divider('=');
    encoder.align(TextAlign.LEFT);

    // ==================== ORDER INFO ====================
    // Bill Number and Date
    encoder.bold(true);
    encoder.printRow('Bill No:', data.billNumber);
    encoder.bold(false);

    const orderDate = new Date(data.orderDate);
    encoder.printRow('Date:', orderDate.toLocaleDateString('en-IN'));
    encoder.printRow('Time:', orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));

    // Order type
    const orderTypeLabels: Record<string, string> = {
        'DINE_IN': 'Dine In',
        'TAKEAWAY': 'Takeaway',
        'DELIVERY': 'Delivery',
        'ONLINE': 'Online Order',
    };
    encoder.printRow('Type:', orderTypeLabels[data.orderType] || data.orderType);

    // Table
    if (data.tableName && data.orderType === 'DINE_IN') {
        encoder.printRow('Table:', data.tableName);
    }

    // Customer info for takeaway/delivery
    if (data.customerName && data.orderType !== 'DINE_IN') {
        encoder.printRow('Customer:', data.customerName);
    }
    if (data.customerPhone && data.orderType !== 'DINE_IN') {
        encoder.printRow('Phone:', data.customerPhone);
    }

    // Cashier
    if (data.cashierName) {
        encoder.printRow('Served By:', data.cashierName);
    }

    encoder.divider('-');

    // ==================== ITEMS ====================
    // Header row
    encoder.bold(true);
    if (printerWidth >= 48) {
        encoder.line('Item                   Qty    Amount');
    } else {
        encoder.line('Item             Qty   Amt');
    }
    encoder.bold(false);
    encoder.divider('-');

    // Item rows
    for (const item of data.items) {
        let itemName = item.name;
        if (item.variant) {
            itemName += ` (${item.variant})`;
        }

        // Truncate long names
        const maxNameLen = printerWidth >= 48 ? 22 : 16;
        if (itemName.length > maxNameLen) {
            itemName = itemName.substring(0, maxNameLen - 1) + '…';
        }

        const qtyStr = item.quantity.toString().padStart(2);
        const amtStr = rupee(item.total.toFixed(2));

        if (printerWidth >= 48) {
            encoder.line(itemName.padEnd(22) + qtyStr.padStart(5) + amtStr.padStart(11));
        } else {
            encoder.line(itemName.padEnd(16) + qtyStr.padStart(3) + amtStr.padStart(8));
        }

        // Addons
        if (item.addons && item.addons.length > 0) {
            for (const addon of item.addons) {
                encoder.line(`  + ${addon}`);
            }
        }

        // Notes
        if (item.notes) {
            encoder.line(`  * ${item.notes}`);
        }
    }

    encoder.divider('-');

    // ==================== TOTALS ====================
    // Subtotal
    encoder.printRow('Subtotal:', rupee(data.subtotal.toFixed(2)));

    // Discount
    if (data.discountAmount > 0) {
        let discLabel = 'Discount:';
        if (data.discountType === 'PERCENTAGE' && data.discountValue) {
            discLabel = `Discount (${data.discountValue}%):`;
        }
        encoder.printRow(discLabel, `-${rupee(data.discountAmount.toFixed(2))}`);
    }

    // GST Breakdown
    if (data.sgst && data.cgst) {
        encoder.printRow('SGST:', rupee(data.sgst.toFixed(2)));
        encoder.printRow('CGST:', rupee(data.cgst.toFixed(2)));
    } else if (data.gstAmount > 0) {
        encoder.printRow('GST:', rupee(data.gstAmount.toFixed(2)));
    }

    encoder.divider('=');

    // Grand Total
    encoder.bold(true).setFontSize(FontSize.DOUBLE_HEIGHT);
    encoder.printRow('TOTAL:', rupee(data.total.toFixed(2)));
    encoder.setFontSize(FontSize.NORMAL).bold(false);

    // ==================== PAYMENT ====================
    if (data.paymentMode) {
        encoder.divider('-');
        encoder.printRow('Payment:', data.paymentMode);

        if (data.amountPaid && data.amountPaid > data.total) {
            encoder.printRow('Paid:', rupee(data.amountPaid.toFixed(2)));
            if (data.changeGiven) {
                encoder.printRow('Change:', rupee(data.changeGiven.toFixed(2)));
            }
        }
    }

    // ==================== UPI QR CODE ====================
    if (data.printQR && data.upiId) {
        encoder.feed(1);
        encoder.align(TextAlign.CENTER);
        encoder.line('Scan to Pay');

        // Generate UPI payment URL
        const upiUrl = `upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(data.businessName)}&am=${data.total}&cu=INR&tn=Bill%20${data.billNumber}`;
        encoder.qrcode(upiUrl, 5);
        encoder.feed(1);
    }

    // ==================== FOOTER ====================
    encoder.align(TextAlign.CENTER);
    encoder.feed(1);

    if (data.footerText) {
        encoder.line(data.footerText);
    } else {
        encoder.line('Thank you for your visit!');
        encoder.line('Please come again');
    }

    encoder.feed(1);
    encoder.line('--- Powered by Billova ---');

    // Cut paper
    encoder.cut(CutType.PARTIAL);

    return encoder;
}

// Generate HTML receipt for browser printing
export function generateReceiptHTML(data: ReceiptData): string {
    const orderTypeLabels: Record<string, string> = {
        'DINE_IN': 'Dine In',
        'TAKEAWAY': 'Takeaway',
        'DELIVERY': 'Delivery',
        'ONLINE': 'Online Order',
    };

    const formatDate = (date: Date) => new Date(date).toLocaleDateString('en-IN');
    const formatTime = (date: Date) => new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

    const itemsHTML = data.items.map(item => {
        let name = item.name;
        if (item.variant) name += ` (${item.variant})`;

        const addonsHTML = item.addons ? item.addons.map(a => `<div class="addon">+ ${a}</div>`).join('') : '';
        const notesHTML = item.notes ? `<div class="note">* ${item.notes}</div>` : '';

        return `
            <tr>
                <td class="item-name">
                    ${name}
                    ${addonsHTML}
                    ${notesHTML}
                </td>
                <td class="item-qty">${item.quantity}</td>
                <td class="item-amt">${formatCurrency(item.total)}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="receipt">
            <div class="header">
                <h1>${data.businessName}</h1>
                ${data.branchName ? `<div>${data.branchName}</div>` : ''}
                ${data.address ? `<div class="address">${data.address}</div>` : ''}
                ${data.phone ? `<div>Tel: ${data.phone}</div>` : ''}
                ${data.gstNumber ? `<div>GSTIN: ${data.gstNumber}</div>` : ''}
                ${data.fssaiNumber ? `<div>FSSAI: ${data.fssaiNumber}</div>` : ''}
            </div>

            <div class="divider"></div>

            <div class="order-info">
                <div class="row"><span class="label">Bill No:</span><span class="value">${data.billNumber}</span></div>
                <div class="row"><span class="label">Date:</span><span class="value">${formatDate(data.orderDate)}</span></div>
                <div class="row"><span class="label">Time:</span><span class="value">${formatTime(data.orderDate)}</span></div>
                <div class="row"><span class="label">Type:</span><span class="value">${orderTypeLabels[data.orderType] || data.orderType}</span></div>
                ${data.tableName && data.orderType === 'DINE_IN' ? `<div class="row"><span class="label">Table:</span><span class="value">${data.tableName}</span></div>` : ''}
                ${data.customerName ? `<div class="row"><span class="label">Customer:</span><span class="value">${data.customerName}</span></div>` : ''}
                ${data.cashierName ? `<div class="row"><span class="label">Served By:</span><span class="value">${data.cashierName}</span></div>` : ''}
            </div>

            <div class="divider"></div>

            <table class="items">
                <thead>
                    <tr>
                        <th class="item-name">Item</th>
                        <th class="item-qty">Qty</th>
                        <th class="item-amt">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <div class="divider dashed"></div>

            <div class="totals">
                <div class="row"><span>Subtotal:</span><span>${formatCurrency(data.subtotal)}</span></div>
                ${data.discountAmount > 0 ? `
                    <div class="row discount">
                        <span>Discount${data.discountType === 'PERCENTAGE' && data.discountValue ? ` (${data.discountValue}%)` : ''}:</span>
                        <span>-${formatCurrency(data.discountAmount)}</span>
                    </div>
                ` : ''}
                ${data.gstAmount > 0 ? `
                    ${data.sgst && data.cgst ? `
                        <div class="row"><span>SGST:</span><span>${formatCurrency(data.sgst)}</span></div>
                        <div class="row"><span>CGST:</span><span>${formatCurrency(data.cgst)}</span></div>
                    ` : `
                        <div class="row"><span>GST:</span><span>${formatCurrency(data.gstAmount)}</span></div>
                    `}
                ` : ''}
            </div>

            <div class="divider"></div>

            <div class="grand-total">
                <span>TOTAL:</span>
                <span>${formatCurrency(data.total)}</span>
            </div>

            ${data.paymentMode ? `
                <div class="payment">
                    <div class="row"><span>Payment:</span><span>${data.paymentMode}</span></div>
                    ${data.amountPaid && data.amountPaid > data.total ? `
                        <div class="row"><span>Paid:</span><span>${formatCurrency(data.amountPaid)}</span></div>
                        ${data.changeGiven ? `<div class="row"><span>Change:</span><span>${formatCurrency(data.changeGiven)}</span></div>` : ''}
                    ` : ''}
                </div>
            ` : ''}

            <div class="footer">
                <p>${data.footerText || 'Thank you for your visit!'}</p>
                <p class="powered">--- Powered by Billova ---</p>
            </div>
        </div>

        <style>
            .receipt {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                width: 80mm;
                padding: 5mm;
            }
            .header { text-align: center; margin-bottom: 10px; }
            .header h1 { font-size: 18px; margin: 0 0 5px; }
            .header .address { font-size: 10px; }
            .divider { border-top: 1px solid #000; margin: 8px 0; }
            .divider.dashed { border-style: dashed; }
            .order-info .row, .totals .row, .payment .row { 
                display: flex; justify-content: space-between; 
            }
            .items { width: 100%; border-collapse: collapse; }
            .items th, .items td { text-align: left; padding: 2px 0; }
            .items .item-qty, .items .item-amt { text-align: right; width: 50px; }
            .addon, .note { font-size: 10px; color: #666; padding-left: 10px; }
            .grand-total { 
                display: flex; justify-content: space-between;
                font-size: 16px; font-weight: bold; margin: 10px 0;
            }
            .discount { color: #c00; }
            .footer { text-align: center; margin-top: 15px; }
            .footer .powered { font-size: 10px; color: #888; }
        </style>
    `;
}

export default generateReceipt;
