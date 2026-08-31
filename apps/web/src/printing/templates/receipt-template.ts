// Receipt & KOT Combined Template Generator — 3-Inch (80mm) Thermal Printing Standard
// Supports: High Contrast Pure Black Typography, Dynamic Online Platforms (Swiggy/Zomato), Order Notes, and 2-Sheet Output

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
    orderNumber?: number | string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE' | string;
    tableName?: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    onlinePlatform?: string;
    onlineOrderId?: string;

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

function getOrderTypeLabel(type: string, platform?: string): string {
    const p = platform ? ` (${platform.toUpperCase()})` : '';
    switch (type) {
        case 'DINE_IN': return 'DINE IN';
        case 'TAKEAWAY': return 'TAKEAWAY';
        case 'DELIVERY': return 'DELIVERY';
        case 'ONLINE': return `ONLINE${p}`;
        default: return (type || 'DINE IN').toUpperCase();
    }
}

/**
 * Format currency with Rupee symbol
 */
function rupee(amount: string | number): string {
    return `Rs. ${Number(amount).toFixed(2)}`;
}

/**
 * Generates 3-Inch (80mm) ESC/POS binary data with auto-cut
 */
export function generateReceipt(data: ReceiptData, printerWidth: 48 | 32 = 48): ESCPOSEncoder {
    const encoder = new ESCPOSEncoder({ width: printerWidth });
    const displayBillNo = formatCleanBillNo(data.billNumber, data.orderNumber);

    encoder.initialize();

    // ==========================================
    // ── SECTION 1: CUSTOMER TAX INVOICE ──
    // ==========================================
    encoder.align(TextAlign.CENTER);

    // Business Header
    encoder.bold(true).setFontSize(FontSize.DOUBLE_WIDTH);
    encoder.line((data.businessName || 'BILLOVA POS').toUpperCase());
    encoder.setFontSize(FontSize.NORMAL).bold(false);

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

    if (data.orderType === 'ONLINE' || data.onlinePlatform) {
        const plat = (data.onlinePlatform || 'ONLINE').toUpperCase();
        encoder.bold(true).printRow('Type:', `ONLINE (${plat})`).bold(false);
        if (data.onlineOrderId) {
            encoder.bold(true).printRow('Online ID:', `#${data.onlineOrderId}`).bold(false);
        }
    } else {
        encoder.printRow('Type:', getOrderTypeLabel(data.orderType));
        if (data.tableName && data.orderType === 'DINE_IN') {
            encoder.bold(true).printRow('Table:', data.tableName).bold(false);
        }
    }

    if (data.customerName) {
        encoder.printRow('Customer:', data.customerName);
    }
    if (data.customerPhone) {
        encoder.printRow('Phone:', data.customerPhone);
    }
    if (data.notes) {
        encoder.bold(true).printRow('Notes:', data.notes).bold(false);
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

    // Auto-Cut after Customer Bill
    encoder.feed(3);
    encoder.cut(CutType.FULL);

    // ==========================================
    // ── SECTION 2: KITCHEN ORDER TICKET (K.O.T.) ──
    // ==========================================
    const shouldIncludeKOT = data.includeKOT !== false;
    if (shouldIncludeKOT) {
        encoder.feed(1);
        encoder.align(TextAlign.CENTER);

        // KOT Title Banner
        encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);
        encoder.line('*** KITCHEN ORDER ***');
        encoder.setFontSize(FontSize.NORMAL).bold(false);

        // Table / Token Headline
        encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);
        if (data.orderType === 'ONLINE' || data.onlinePlatform) {
            const plat = (data.onlinePlatform || 'ONLINE').toUpperCase();
            encoder.line(`ONLINE: ${plat}`);
            if (data.onlineOrderId) {
                encoder.line(`ID: #${data.onlineOrderId}`);
            }
        } else if (data.tableName && data.orderType === 'DINE_IN') {
            encoder.line(`TABLE: ${data.tableName.toUpperCase()}`);
        } else {
            encoder.line(`TOKEN: ${displayBillNo}`);
        }
        encoder.setFontSize(FontSize.NORMAL).bold(false);

        encoder.line(`TYPE: ${getOrderTypeLabel(data.orderType, data.onlinePlatform).toUpperCase()}`);
        encoder.divider('=');
        encoder.align(TextAlign.LEFT);

        // KOT Meta Details
        encoder.bold(true);
        encoder.printRow('KOT No:', displayBillNo);
        encoder.bold(false);
        encoder.printRow('Time:', orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
        encoder.printRow('Date:', orderDate.toLocaleDateString('en-IN'));

        if (data.notes) {
            encoder.divider('-');
            encoder.bold(true).line(`ORDER NOTE: ** ${data.notes.toUpperCase()} **`).bold(false);
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
 * Features: High contrast black typography, Swiggy/Zomato badges, Order Notes, and 2-Sheet Output
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
        let itemName = item.name.toUpperCase();
        if (item.variant) itemName += ` (${item.variant.toUpperCase()})`;

        const addonsHTML = item.addons && item.addons.length > 0
            ? item.addons.map(a => `<div class="kot-addon-line">+ ${a.toUpperCase()}</div>`).join('')
            : '';

        const itemNoteHTML = item.notes
            ? `<div class="kot-item-note">** ${item.notes.toUpperCase()} **</div>`
            : '';

        return `
            <div class="kot-item-entry">
                <div class="kot-item-main">
                    <span class="kot-qty-badge">[ ${item.quantity}x ]</span>
                    <span class="kot-item-name">${itemName}</span>
                </div>
                ${addonsHTML}
                ${itemNoteHTML}
            </div>
        `;
    }).join('');

    const isOnline = data.orderType === 'ONLINE' || Boolean(data.onlinePlatform);
    const platformName = (data.onlinePlatform || 'ONLINE').toUpperCase();

    return `
        <div class="thermal-document">
            <!-- ========================================== -->
            <!-- ── SECTION 1: CUSTOMER TAX BILL / INVOICE ── -->
            <!-- ========================================== -->
            <div class="thermal-receipt customer-bill">
                <div class="thermal-center">
                    <h1 class="thermal-brand-title">${(data.businessName || 'BILLOVA POS').toUpperCase()}</h1>
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
                    
                    ${isOnline ? `
                        <div class="thermal-meta-row"><span class="meta-label">Type:</span><strong class="meta-val highlight">ONLINE (${platformName})</strong></div>
                        ${data.onlineOrderId ? `<div class="thermal-meta-row"><span class="meta-label">Online ID:</span><strong class="meta-val highlight">#${data.onlineOrderId}</strong></div>` : ''}
                    ` : `
                        <div class="thermal-meta-row"><span class="meta-label">Type:</span><strong class="meta-val">${getOrderTypeLabel(data.orderType)}</strong></div>
                        ${data.tableName && data.orderType === 'DINE_IN' ? `<div class="thermal-meta-row"><span class="meta-label">Table:</span><strong class="meta-val highlight">${data.tableName}</strong></div>` : ''}
                    `}

                    ${data.customerName ? `<div class="thermal-meta-row"><span class="meta-label">Customer:</span><span class="meta-val">${data.customerName}</span></div>` : ''}
                    ${data.customerPhone ? `<div class="thermal-meta-row"><span class="meta-label">Phone:</span><span class="meta-val">${data.customerPhone}</span></div>` : ''}
                    ${data.notes ? `<div class="thermal-meta-row"><span class="meta-label">Notes:</span><span class="meta-val highlight">${data.notes}</span></div>` : ''}
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
                        ${isOnline
                            ? `<div class="kot-table-name">ONLINE: ${platformName}</div>`
                            : (data.tableName && data.orderType === 'DINE_IN'
                                ? `<div class="kot-table-name">TABLE: ${data.tableName.toUpperCase()}</div>`
                                : `<div class="kot-table-name">TOKEN: ${displayBillNo}</div>`
                            )
                        }
                    </div>
                    ${isOnline && data.onlineOrderId ? `<div class="kot-online-order-id">ONLINE ORDER #${data.onlineOrderId}</div>` : ''}
                    <div class="kot-type-pill">TYPE: ${getOrderTypeLabel(data.orderType, data.onlinePlatform).toUpperCase()}</div>
                </div>

                <div class="thermal-divider solid"></div>

                <div class="thermal-meta-list">
                    <div class="thermal-meta-row"><span class="meta-label">KOT No:</span><strong class="meta-val">${displayBillNo}</strong></div>
                    <div class="thermal-meta-row"><span class="meta-label">Time:</span><strong class="meta-val">${formatTime(orderDate)}</strong></div>
                    <div class="thermal-meta-row"><span class="meta-label">Date:</span><span class="meta-val">${formatDate(orderDate)}</span></div>
                </div>

                ${data.notes ? `
                    <div class="kot-notes-box">
                        <div class="kot-notes-title">** ORDER NOTES **</div>
                        <div class="kot-notes-content">${data.notes.toUpperCase()}</div>
                    </div>
                ` : ''}

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
                line-height: 1.25;
            }

            .thermal-invoice-badge {
                font-size: 12px;
                font-weight: 900;
                margin-top: 4px;
                letter-spacing: 0.05em;
            }

            /* Metadata List */
            .thermal-meta-list {
                display: flex;
                flex-direction: column;
                gap: 3px;
                margin: 4px 0;
            }

            .thermal-meta-row {
                display: flex;
                justify-content: space-between;
                font-size: 11.5px;
                font-weight: 600;
            }

            .thermal-meta-row strong {
                font-weight: 900;
            }

            .thermal-meta-row .highlight {
                font-size: 13px;
                font-weight: 900;
            }

            /* Table Formatting */
            .thermal-table {
                width: 100%;
                border-collapse: collapse;
                margin: 6px 0;
                font-size: 11px;
            }

            .thermal-table th {
                border-bottom: 1.5px solid #000000;
                padding-bottom: 4px;
                font-weight: 900;
                text-align: left;
            }

            .thermal-table td {
                padding: 4px 0;
                vertical-align: top;
            }

            .col-name { width: 44%; text-align: left; }
            .col-qty { width: 14%; text-align: center; font-weight: 900; font-size: 12px; }
            .col-price { width: 20%; text-align: right; }
            .col-amt { width: 22%; text-align: right; font-weight: 800; }

            .item-title {
                font-weight: 800;
                line-height: 1.2;
            }

            .thermal-addon {
                font-size: 10px;
                font-weight: 600;
                padding-left: 4px;
            }

            .thermal-note {
                font-size: 10px;
                font-style: italic;
                font-weight: 700;
                padding-left: 4px;
            }

            /* Totals Box */
            .thermal-totals-box {
                display: flex;
                flex-direction: column;
                gap: 3px;
                margin: 4px 0;
            }

            .thermal-total-row {
                display: flex;
                justify-content: space-between;
                font-size: 11.5px;
                font-weight: 600;
            }

            .thermal-grand-total {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 17px;
                font-weight: 900;
                padding: 4px 0;
                letter-spacing: 0.02em;
            }

            .grand-price {
                font-size: 18px;
                font-weight: 900;
            }

            .thermal-payment-box {
                margin: 4px 0;
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
                border: 2px solid #000000;
                padding: 4px 8px;
                margin: 4px 0;
                width: 100%;
                text-align: center;
            }

            .kot-table-name {
                font-size: 19px;
                font-weight: 900;
                letter-spacing: 0.04em;
            }

            .kot-online-order-id {
                font-size: 14px;
                font-weight: 900;
                margin-top: 2px;
            }

            .kot-type-pill {
                font-size: 12px;
                font-weight: 900;
                margin-top: 2px;
            }

            .kot-notes-box {
                border: 1.5px dashed #000000;
                padding: 5px 8px;
                margin: 6px 0;
                text-align: center;
                background: #f9f9f9;
            }

            .kot-notes-title {
                font-size: 11px;
                font-weight: 900;
                margin-bottom: 2px;
            }

            .kot-notes-content {
                font-size: 13px;
                font-weight: 900;
            }

            .kot-items-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin: 6px 0;
            }

            .kot-item-entry {
                display: flex;
                flex-direction: column;
                gap: 2px;
                border-bottom: 1px dotted #000000;
                padding-bottom: 5px;
            }

            .kot-item-main {
                display: flex;
                align-items: baseline;
                gap: 6px;
            }

            .kot-qty-badge {
                font-size: 16px;
                font-weight: 900;
                min-width: 50px;
            }

            .kot-item-name {
                font-size: 14px;
                font-weight: 900;
                line-height: 1.25;
            }

            .kot-addon-line {
                font-size: 11px;
                font-weight: 700;
                padding-left: 54px;
            }

            .kot-item-note {
                font-size: 11.5px;
                font-weight: 900;
                text-decoration: underline;
                padding-left: 54px;
                margin-top: 2px;
            }

            .kot-summary-row {
                font-size: 14px;
                font-weight: 900;
                padding: 4px 0;
            }

            .kot-footer {
                margin-top: 6px;
                font-size: 11px;
                font-weight: 800;
            }
        </style>
    `;
}

export default {
    generateReceipt,
    generateReceiptHTML,
};
