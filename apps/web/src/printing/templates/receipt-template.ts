// Receipt & KOT Template Generator — Optimized for 3-Inch (80mm) Thermal Printers
// Supports: Customer Bill + Auto-Cut Separator + Kitchen KOT in a single unified print job

import { ESCPOSEncoder, TextAlign, FontSize, CutType } from '../escpos/escpos-encoder';

export interface ReceiptItem {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    variant?: string;
    addons?: string[];
    notes?: string;
    isVeg?: boolean;
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
    orderNumber?: number | string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE' | string;
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
    orderDate: Date | string;
    cashierName?: string;

    // Footer
    footerText?: string;
    printQR?: boolean;
    upiId?: string;

    // KOT Options
    includeKOT?: boolean;
    kotNumber?: number | string;
}

// Clean helper to format Bill / Order No without ever showing 'undefined'
function formatCleanBillNo(billNo?: string, orderNo?: number | string): string {
    if (billNo && !billNo.includes('undefined') && billNo.trim() !== '') {
        return billNo;
    }
    if (orderNo && !String(orderNo).includes('undefined') && String(orderNo).trim() !== '') {
        return `#${String(orderNo).padStart(3, '0')}`;
    }
    return `#${Date.now().toString().slice(-4)}`;
}

// Format Order Type
function getOrderTypeLabel(type: string): string {
    switch (type) {
        case 'DINE_IN': return 'Dine In';
        case 'TAKEAWAY': return 'Takeaway';
        case 'DELIVERY': return 'Delivery';
        case 'ONLINE': return 'Online Order';
        default: return type || 'Dine In';
    }
}

/**
 * Generates ESC/POS thermal bytecode (Customer Bill + Auto-Cut + Kitchen KOT)
 */
export function generateReceipt(data: ReceiptData, printerWidth: 48 | 32 = 48): ESCPOSEncoder {
    const encoder = new ESCPOSEncoder({ width: printerWidth });
    const rupee = encoder.rupee.bind(encoder);
    const displayBillNo = formatCleanBillNo(data.billNumber, data.orderNumber);

    encoder.initialize();

    // ==========================================
    // ── SECTION 1: CUSTOMER TAX BILL / INVOICE ──
    // ==========================================
    encoder.align(TextAlign.CENTER);

    // Business Name (Double size, bold)
    encoder.setFontSize(FontSize.DOUBLE_BOTH).bold(true);
    encoder.line((data.businessName || 'BILLOVA POS').toUpperCase());
    encoder.setFontSize(FontSize.NORMAL).bold(false);

    // Branch & Contact Details
    if (data.branchName) encoder.line(data.branchName);
    if (data.address) encoder.line(data.address);
    if (data.phone) encoder.line(`Tel: ${data.phone}`);
    if (data.gstNumber) encoder.line(`GSTIN: ${data.gstNumber}`);
    if (data.fssaiNumber) encoder.line(`FSSAI: ${data.fssaiNumber}`);

    encoder.bold(true).line('*** TAX INVOICE ***').bold(false);
    encoder.divider('=');
    encoder.align(TextAlign.LEFT);

    // Order Info
    encoder.bold(true);
    encoder.printRow('Bill No:', displayBillNo);
    encoder.bold(false);

    const orderDate = new Date(data.orderDate || Date.now());
    encoder.printRow('Date:', orderDate.toLocaleDateString('en-IN'));
    encoder.printRow('Time:', orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
    encoder.printRow('Type:', getOrderTypeLabel(data.orderType));

    if (data.tableName && data.orderType === 'DINE_IN') {
        encoder.bold(true).printRow('Table:', data.tableName).bold(false);
    }
    if (data.customerName) {
        encoder.printRow('Customer:', data.customerName);
    }
    if (data.customerPhone) {
        encoder.printRow('Phone:', data.customerPhone);
    }
    if (data.cashierName) {
        encoder.printRow('Served By:', data.cashierName);
    }

    encoder.divider('-');

    // Items Header
    encoder.bold(true);
    if (printerWidth >= 48) {
        encoder.line('ITEM                   QTY    PRICE    AMOUNT');
    } else {
        encoder.line('ITEM             QTY   AMT');
    }
    encoder.bold(false);
    encoder.divider('-');

    // Items List
    for (const item of data.items) {
        let itemName = item.name;
        if (item.variant) itemName += ` (${item.variant})`;

        const maxNameLen = printerWidth >= 48 ? 20 : 14;
        if (itemName.length > maxNameLen) {
            itemName = itemName.substring(0, maxNameLen - 1) + '…';
        }

        const qtyStr = item.quantity.toString().padStart(2);
        const priceStr = (item.unitPrice || (item.total / item.quantity)).toFixed(2);
        const amtStr = rupee(item.total.toFixed(2));

        if (printerWidth >= 48) {
            encoder.line(itemName.padEnd(20) + qtyStr.padStart(4) + priceStr.padStart(9) + amtStr.padStart(11));
        } else {
            encoder.line(itemName.padEnd(14) + qtyStr.padStart(3) + amtStr.padStart(8));
        }

        if (item.addons && item.addons.length > 0) {
            for (const addon of item.addons) {
                encoder.line(`  + ${addon}`);
            }
        }
        if (item.notes) {
            encoder.line(`  * ${item.notes}`);
        }
    }

    encoder.divider('-');

    // Totals
    encoder.printRow('Subtotal:', rupee(data.subtotal.toFixed(2)));

    if (data.discountAmount > 0) {
        let discLabel = 'Discount:';
        if (data.discountType === 'PERCENTAGE' && data.discountValue) {
            discLabel = `Discount (${data.discountValue}%):`;
        }
        encoder.printRow(discLabel, `-${rupee(data.discountAmount.toFixed(2))}`);
    }

    if (data.sgst && data.cgst) {
        encoder.printRow('SGST:', rupee(data.sgst.toFixed(2)));
        encoder.printRow('CGST:', rupee(data.cgst.toFixed(2)));
    } else if (data.gstAmount > 0) {
        encoder.printRow('GST:', rupee(data.gstAmount.toFixed(2)));
    }

    encoder.divider('=');

    // Grand Total (Large Bold)
    encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);
    encoder.printRow('TOTAL:', rupee(data.total.toFixed(2)));
    encoder.setFontSize(FontSize.NORMAL).bold(false);

    // Payment Info
    if (data.paymentMode) {
        encoder.divider('-');
        encoder.bold(true);
        encoder.printRow('Payment Mode:', `PAID VIA ${data.paymentMode.toUpperCase()}`);
        encoder.bold(false);
    }

    // Customer Footer
    encoder.align(TextAlign.CENTER);
    encoder.feed(1);
    encoder.line(data.footerText || 'Thank you for dining with us! Please visit again.');
    encoder.line('--- Powered by Billova POS ---');

    // ==========================================
    // ── AUTO-CUT AFTER CUSTOMER BILL ──
    // ==========================================
    encoder.feed(3);
    encoder.cut(CutType.FULL);

    // ==========================================
    // ── SECTION 2: KITCHEN ORDER TICKET (K.O.T.) ──
    // ==========================================
    const shouldIncludeKOT = data.includeKOT !== false;
    if (shouldIncludeKOT) {
        encoder.feed(1);
        encoder.align(TextAlign.CENTER);

        // KOT Title Banner (Large Inverted or Bold)
        encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);
        encoder.line('*** KITCHEN ORDER ***');
        encoder.setFontSize(FontSize.NORMAL).bold(false);

        // Table / Token Headline (Extra Large)
        encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);
        if (data.tableName && data.orderType === 'DINE_IN') {
            encoder.line(`TABLE: ${data.tableName.toUpperCase()}`);
        } else {
            encoder.line(`TOKEN: ${displayBillNo}`);
        }
        encoder.setFontSize(FontSize.NORMAL).bold(false);

        encoder.line(`TYPE: ${getOrderTypeLabel(data.orderType).toUpperCase()}`);
        encoder.divider('=');
        encoder.align(TextAlign.LEFT);

        // KOT Meta Details
        encoder.bold(true);
        encoder.printRow('KOT No:', displayBillNo);
        encoder.bold(false);
        encoder.printRow('Time:', orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
        encoder.printRow('Date:', orderDate.toLocaleDateString('en-IN'));
        if (data.cashierName) {
            encoder.printRow('Server:', data.cashierName);
        }

        encoder.divider('=');

        // KOT Items (Double Size for Kitchen Visibility)
        encoder.bold(true).setFontSize(FontSize.DOUBLE_HEIGHT);
        let totalItemsCount = 0;

        for (const item of data.items) {
            totalItemsCount += item.quantity;
            const qtyStr = `[ ${item.quantity}x ] `;
            let itemName = item.name.toUpperCase();
            if (item.variant) itemName += ` (${item.variant.toUpperCase()})`;

            encoder.line(qtyStr + itemName);

            if (item.addons && item.addons.length > 0) {
                for (const addon of item.addons) {
                    encoder.line(`   + ${addon.toUpperCase()}`);
                }
            }

            if (item.notes) {
                encoder.underline(true);
                encoder.line(`   ** ${item.notes.toUpperCase()} **`);
                encoder.underline(false);
            }
            encoder.feed(1);
        }

        encoder.setFontSize(FontSize.NORMAL).bold(false);
        encoder.divider('=');

        // Summary
        encoder.bold(true);
        encoder.printRow('TOTAL ITEMS:', `${totalItemsCount} ITEMS`);
        encoder.bold(false);

        encoder.align(TextAlign.CENTER);
        encoder.feed(1);
        encoder.line('*** END OF KOT ***');
        encoder.feed(3);

        // Auto-cut after KOT
        encoder.cut(CutType.FULL);
    }

    return encoder;
}

/**
 * Generates 3-Inch (80mm) Thermal HTML for Browser Print & Driver
 * Features: High contrast black typography, clear layout, and page-break auto-cut separator
 */
export function generateReceiptHTML(data: ReceiptData): string {
    const displayBillNo = formatCleanBillNo(data.billNumber, data.orderNumber);
    const orderDate = new Date(data.orderDate || Date.now());
    const formatDate = (d: Date) => d.toLocaleDateString('en-IN');
    const formatTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const formatCurrency = (amt: number) => `₹${Number(amt || 0).toFixed(2)}`;

    // Customer Items Rows
    const itemsHTML = data.items.map(item => {
        let name = item.name;
        if (item.variant) name += ` (${item.variant})`;

        const addonsHTML = item.addons && item.addons.length > 0
            ? item.addons.map(a => `<div class="thermal-addon">+ ${a}</div>`).join('')
            : '';
        const notesHTML = item.notes
            ? `<div class="thermal-note">* ${item.notes}</div>`
            : '';

        const unitPrice = item.unitPrice || (item.total / item.quantity);

        return `
            <tr>
                <td class="col-name">
                    <div class="item-title">${name}</div>
                    ${addonsHTML}
                    ${notesHTML}
                </td>
                <td class="col-qty">${item.quantity}</td>
                <td class="col-price">${unitPrice.toFixed(2)}</td>
                <td class="col-amt">${item.total.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    // Kitchen KOT Items Rows
    let totalItemsCount = 0;
    const kotItemsHTML = data.items.map(item => {
        totalItemsCount += item.quantity;
        let name = item.name.toUpperCase();
        if (item.variant) name += ` (${item.variant.toUpperCase()})`;

        const addonsHTML = item.addons && item.addons.length > 0
            ? item.addons.map(a => `<div class="kot-addon">+ ${a.toUpperCase()}</div>`).join('')
            : '';
        const notesHTML = item.notes
            ? `<div class="kot-special-note">** ${item.notes.toUpperCase()} **</div>`
            : '';

        return `
            <div class="kot-item-card">
                <span class="kot-qty-badge">[ ${item.quantity}x ]</span>
                <div class="kot-item-details">
                    <span class="kot-item-name">${name}</span>
                    ${addonsHTML}
                    ${notesHTML}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="thermal-document">
            <!-- ========================================== -->
            <!-- ── SECTION 1: CUSTOMER TAX BILL / INVOICE ── -->
            <!-- ========================================== -->
            <div class="thermal-receipt customer-bill">
                <div class="thermal-center">
                    <h1 class="thermal-brand-title">${(data.businessName || 'BILLOVA POS').toUpperCase()}</h1>
                    ${data.branchName ? `<div class="thermal-sub-text">${data.branchName}</div>` : ''}
                    ${data.address ? `<div class="thermal-sub-text">${data.address}</div>` : ''}
                    ${data.phone ? `<div class="thermal-sub-text">Tel: ${data.phone}</div>` : ''}
                    ${data.gstNumber ? `<div class="thermal-sub-text">GSTIN: ${data.gstNumber}</div>` : ''}
                    ${data.fssaiNumber ? `<div class="thermal-sub-text">FSSAI: ${data.fssaiNumber}</div>` : ''}
                    <div class="thermal-invoice-badge">*** TAX INVOICE ***</div>
                </div>

                <div class="thermal-divider solid"></div>

                <div class="thermal-meta-list">
                    <div class="thermal-meta-row"><span class="meta-label">Bill No:</span><strong class="meta-val">${displayBillNo}</strong></div>
                    <div class="thermal-meta-row"><span class="meta-label">Date:</span><span class="meta-val">${formatDate(orderDate)}</span></div>
                    <div class="thermal-meta-row"><span class="meta-label">Time:</span><span class="meta-val">${formatTime(orderDate)}</span></div>
                    <div class="thermal-meta-row"><span class="meta-label">Type:</span><strong class="meta-val">${getOrderTypeLabel(data.orderType)}</strong></div>
                    ${data.tableName && data.orderType === 'DINE_IN' ? `<div class="thermal-meta-row"><span class="meta-label">Table:</span><strong class="meta-val highlight">${data.tableName}</strong></div>` : ''}
                    ${data.customerName ? `<div class="thermal-meta-row"><span class="meta-label">Customer:</span><span class="meta-val">${data.customerName}</span></div>` : ''}
                    ${data.customerPhone ? `<div class="thermal-meta-row"><span class="meta-label">Phone:</span><span class="meta-val">${data.customerPhone}</span></div>` : ''}
                    ${data.cashierName ? `<div class="thermal-meta-row"><span class="meta-label">Served By:</span><span class="meta-val">${data.cashierName}</span></div>` : ''}
                </div>

                <div class="thermal-divider solid"></div>

                <table class="thermal-table">
                    <thead>
                        <tr>
                            <th class="col-name">ITEM</th>
                            <th class="col-qty">QTY</th>
                            <th class="col-price">PRICE</th>
                            <th class="col-amt">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <div class="thermal-divider dashed"></div>

                <div class="thermal-totals-box">
                    <div class="thermal-total-row"><span>Subtotal:</span><span>${formatCurrency(data.subtotal)}</span></div>
                    ${data.discountAmount > 0 ? `
                        <div class="thermal-total-row">
                            <span>Discount${data.discountType === 'PERCENTAGE' && data.discountValue ? ` (${data.discountValue}%)` : ''}:</span>
                            <span>-${formatCurrency(data.discountAmount)}</span>
                        </div>
                    ` : ''}
                    ${data.gstAmount > 0 ? `
                        ${data.sgst && data.cgst ? `
                            <div class="thermal-total-row"><span>SGST:</span><span>${formatCurrency(data.sgst)}</span></div>
                            <div class="thermal-total-row"><span>CGST:</span><span>${formatCurrency(data.cgst)}</span></div>
                        ` : `
                            <div class="thermal-total-row"><span>GST:</span><span>${formatCurrency(data.gstAmount)}</span></div>
                        `}
                    ` : ''}
                </div>

                <div class="thermal-divider double"></div>

                <div class="thermal-grand-total">
                    <span>TOTAL:</span>
                    <span class="grand-price">${formatCurrency(data.total)}</span>
                </div>

                <div class="thermal-divider solid"></div>

                ${data.paymentMode ? `
                    <div class="thermal-payment-box">
                        <div class="thermal-total-row">
                            <span>Payment Mode:</span>
                            <strong>PAID VIA ${data.paymentMode.toUpperCase()}</strong>
                        </div>
                        ${data.amountPaid && data.amountPaid > data.total ? `
                            <div class="thermal-total-row"><span>Paid:</span><span>${formatCurrency(data.amountPaid)}</span></div>
                            ${data.changeGiven ? `<div class="thermal-total-row"><span>Change:</span><span>${formatCurrency(data.changeGiven)}</span></div>` : ''}
                        ` : ''}
                    </div>
                ` : ''}

                <div class="thermal-footer">
                    <div class="thank-you-msg">${data.footerText || 'Thank you for dining with us! Please visit again.'}</div>
                    <div class="powered-msg">--- Powered by Billova POS ---</div>
                </div>
            </div>

            <!-- ========================================== -->
            <!-- ── SECTION 2: KITCHEN ORDER TICKET (K.O.T.) ── -->
            <!-- ========================================== -->
            <div class="thermal-receipt kitchen-kot">
                <div class="thermal-center">
                    <div class="kot-header-tag">*** KITCHEN ORDER ***</div>
                    <div class="kot-table-banner">
                        ${data.tableName && data.orderType === 'DINE_IN'
                            ? `<div class="kot-table-name">TABLE: ${data.tableName.toUpperCase()}</div>`
                            : `<div class="kot-table-name">TOKEN: ${displayBillNo}</div>`
                        }
                    </div>
                    <div class="kot-type-pill">TYPE: ${getOrderTypeLabel(data.orderType).toUpperCase()}</div>
                </div>

                <div class="thermal-divider solid"></div>

                <div class="thermal-meta-list">
                    <div class="thermal-meta-row"><span class="meta-label">KOT No:</span><strong class="meta-val">${displayBillNo}</strong></div>
                    <div class="thermal-meta-row"><span class="meta-label">Time:</span><strong class="meta-val">${formatTime(orderDate)}</strong></div>
                    <div class="thermal-meta-row"><span class="meta-label">Date:</span><span class="meta-val">${formatDate(orderDate)}</span></div>
                    ${data.cashierName ? `<div class="thermal-meta-row"><span class="meta-label">Server:</span><span class="meta-val">${data.cashierName}</span></div>` : ''}
                </div>

                <div class="thermal-divider double"></div>

                <!-- Kitchen Checklist -->
                <div class="kot-items-container">
                    ${kotItemsHTML}
                </div>

                <div class="thermal-divider solid"></div>

                <div class="thermal-meta-row kot-summary-row">
                    <span>TOTAL ITEMS:</span>
                    <strong>${totalItemsCount} ITEMS</strong>
                </div>

                <div class="thermal-footer kot-footer">
                    <div class="powered-msg">*** END OF KOT ***</div>
                </div>
            </div>
        </div>

        <style>
            /* 3-Inch (80mm) Thermal Styling — Deep Black High Contrast */
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                color: #000000 !important;
                -webkit-font-smoothing: antialiased;
            }

            .thermal-document {
                width: 76mm;
                max-width: 80mm;
                margin: 0 auto;
                background: #ffffff;
                font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
                font-size: 12px;
                line-height: 1.35;
                font-weight: 700;
                color: #000000 !important;
                padding: 3mm 2mm;
            }

            .thermal-receipt {
                width: 100%;
                display: flex;
                flex-direction: column;
                color: #000000 !important;
            }

            /* Customer Bill & KOT Print Page Breaks */
            @media print {
                @page {
                    margin: 0;
                    size: 80mm auto;
                }
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                }
                .thermal-document {
                    width: 78mm !important;
                    padding: 2mm 1mm !important;
                }
                .customer-bill {
                    page-break-after: always !important;
                    break-after: page !important;
                }
                .kitchen-kot {
                    page-break-before: always !important;
                    break-before: page !important;
                }
            }

            /* Dividers */
            .thermal-divider {
                width: 100%;
                margin: 6px 0;
            }
            .thermal-divider.solid {
                border-top: 1.5px solid #000000;
            }
            .thermal-divider.dashed {
                border-top: 1.5px dashed #000000;
            }
            .thermal-divider.double {
                border-top: 3px double #000000;
            }

            /* Center & Brand */
            .thermal-center {
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }

            .thermal-brand-title {
                font-size: 18px;
                font-weight: 900;
                letter-spacing: 0.05em;
                margin-bottom: 2px;
            }

            .thermal-sub-text {
                font-size: 11px;
                font-weight: 600;
            }

            .thermal-invoice-badge {
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.08em;
                margin-top: 4px;
            }

            /* Meta rows */
            .thermal-meta-list {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .thermal-meta-row {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
            }

            .meta-label {
                font-weight: 700;
            }

            .meta-val {
                font-weight: 800;
                text-align: right;
            }

            .meta-val.highlight {
                font-size: 13px;
                text-decoration: underline;
            }

            /* Items Table */
            .thermal-table {
                width: 100%;
                border-collapse: collapse;
                margin: 4px 0;
            }

            .thermal-table th {
                font-size: 11px;
                font-weight: 900;
                text-align: left;
                padding: 3px 0;
                border-bottom: 1.5px solid #000000;
            }

            .thermal-table td {
                padding: 3px 0;
                font-size: 11.5px;
                font-weight: 700;
                vertical-align: top;
            }

            .col-name { text-align: left; width: 45%; }
            .col-qty { text-align: center; width: 14%; font-weight: 800; }
            .col-price { text-align: right; width: 20%; }
            .col-amt { text-align: right; width: 21%; font-weight: 800; }

            .item-title {
                font-weight: 800;
                line-height: 1.25;
            }

            .thermal-addon, .thermal-note {
                font-size: 10px;
                font-weight: 700;
                padding-left: 6px;
            }

            /* Totals */
            .thermal-totals-box {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .thermal-total-row {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                font-weight: 700;
            }

            /* Grand Total */
            .thermal-grand-total {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                font-size: 16px;
                font-weight: 900;
                padding: 4px 0;
            }

            .grand-price {
                font-size: 18px;
                font-weight: 900;
            }

            /* Payment & Footer */
            .thermal-payment-box {
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding: 2px 0;
            }

            .thermal-footer {
                text-align: center;
                margin-top: 8px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .thank-you-msg {
                font-size: 11.5px;
                font-weight: 800;
            }

            .powered-msg {
                font-size: 10px;
                font-weight: 700;
                margin-top: 4px;
            }

            /* ── Kitchen KOT Styling ── */
            .kitchen-kot {
                padding-top: 4px;
            }

            .kot-header-tag {
                font-size: 16px;
                font-weight: 900;
                letter-spacing: 0.05em;
            }

            .kot-table-banner {
                margin: 4px 0;
                padding: 4px 8px;
                border: 2px solid #000000;
                width: 100%;
                text-align: center;
            }

            .kot-table-name {
                font-size: 18px;
                font-weight: 900;
            }

            .kot-type-pill {
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.05em;
            }

            .kot-items-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin: 6px 0;
            }

            .kot-item-card {
                display: flex;
                gap: 8px;
                align-items: baseline;
            }

            .kot-qty-badge {
                font-size: 16px;
                font-weight: 900;
                min-width: 44px;
            }

            .kot-item-details {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 1px;
            }

            .kot-item-name {
                font-size: 15px;
                font-weight: 900;
                line-height: 1.25;
            }

            .kot-addon {
                font-size: 11px;
                font-weight: 700;
            }

            .kot-special-note {
                font-size: 12px;
                font-weight: 900;
                text-decoration: underline;
                margin-top: 2px;
            }

            .kot-summary-row {
                font-size: 14px;
                font-weight: 900;
                padding: 4px 0;
            }

            .kot-footer {
                margin-top: 10px;
            }
        </style>
    `;
}

export default generateReceipt;
