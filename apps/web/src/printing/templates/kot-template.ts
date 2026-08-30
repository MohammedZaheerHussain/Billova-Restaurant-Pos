// KOT (Kitchen Order Ticket) Template Generator — 3-Inch (80mm) Thermal Printing Standard

import { ESCPOSEncoder, TextAlign, FontSize, CutType } from '../escpos/escpos-encoder';

export interface KOTItem {
    name: string;
    quantity: number;
    variant?: string;
    addons?: string[];
    notes?: string;
    isVeg?: boolean;
}

export interface KOTData {
    // Order Info
    kotNumber: number | string;
    orderNumber?: number | string;
    billNumber?: string;
    tableName?: string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE' | string;

    // Items
    items: KOTItem[];

    // Metadata
    createdAt: Date | string;
    serverName?: string;
    priority?: 'NORMAL' | 'RUSH' | 'VIP';

    // Special instructions
    orderNotes?: string;
}

// Clean helper to format KOT / Order No
function formatCleanKotNo(kotNo?: number | string, orderNo?: number | string): string {
    if (kotNo && !String(kotNo).includes('undefined') && String(kotNo).trim() !== '') {
        return `#${String(kotNo).replace(/^#/, '').padStart(3, '0')}`;
    }
    if (orderNo && !String(orderNo).includes('undefined') && String(orderNo).trim() !== '') {
        return `#${String(orderNo).padStart(3, '0')}`;
    }
    return `#${Date.now().toString().slice(-4)}`;
}

function getOrderTypeLabel(type: string): string {
    switch (type) {
        case 'DINE_IN': return 'DINE IN';
        case 'TAKEAWAY': return 'TAKEAWAY';
        case 'DELIVERY': return 'DELIVERY';
        case 'ONLINE': return 'ONLINE ORDER';
        default: return (type || 'DINE IN').toUpperCase();
    }
}

export function generateKOT(data: KOTData, printerWidth: 48 | 32 = 48): ESCPOSEncoder {
    const encoder = new ESCPOSEncoder({ width: printerWidth });
    const displayKotNo = formatCleanKotNo(data.kotNumber, data.orderNumber);
    const kotDate = new Date(data.createdAt || Date.now());

    encoder.initialize();

    // ==================== HEADER ====================
    encoder.align(TextAlign.CENTER);

    // KOT Title Banner
    encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);
    encoder.line('*** KITCHEN ORDER ***');
    encoder.setFontSize(FontSize.NORMAL).bold(false);

    // Table / Token
    encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);
    if (data.tableName && data.orderType === 'DINE_IN') {
        encoder.line(`TABLE: ${data.tableName.toUpperCase()}`);
    } else {
        encoder.line(`TOKEN: ${displayKotNo}`);
    }
    encoder.setFontSize(FontSize.NORMAL).bold(false);

    encoder.line(`TYPE: ${getOrderTypeLabel(data.orderType)}`);
    encoder.divider('=');
    encoder.align(TextAlign.LEFT);

    // Order Info
    encoder.bold(true);
    encoder.printRow('KOT No:', displayKotNo);
    encoder.bold(false);
    encoder.printRow('Time:', kotDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
    encoder.printRow('Date:', kotDate.toLocaleDateString('en-IN'));

    if (data.serverName) {
        encoder.printRow('Server:', data.serverName);
    }

    encoder.divider('=');

    // Items (Double Size for Kitchen Visibility)
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

    // Auto-cut
    encoder.cut(CutType.FULL);

    // Beep kitchen
    encoder.beep(2, 100);

    return encoder;
}

export function generateKOTHTML(data: KOTData): string {
    const displayKotNo = formatCleanKotNo(data.kotNumber, data.orderNumber);
    const kotDate = new Date(data.createdAt || Date.now());
    const formatTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const formatDate = (d: Date) => d.toLocaleDateString('en-IN');

    let totalItemsCount = 0;
    const itemsHTML = data.items.map(item => {
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
        <div class="thermal-kot-doc">
            <div class="thermal-center">
                <div class="kot-header-tag">*** KITCHEN ORDER ***</div>
                <div class="kot-table-banner">
                    ${data.tableName && data.orderType === 'DINE_IN'
                        ? `<div class="kot-table-name">TABLE: ${data.tableName.toUpperCase()}</div>`
                        : `<div class="kot-table-name">TOKEN: ${displayKotNo}</div>`
                    }
                </div>
                <div class="kot-type-pill">TYPE: ${getOrderTypeLabel(data.orderType)}</div>
            </div>

            <div class="thermal-divider solid"></div>

            <div class="thermal-meta-list">
                <div class="thermal-meta-row"><span class="meta-label">KOT No:</span><strong class="meta-val">${displayKotNo}</strong></div>
                <div class="thermal-meta-row"><span class="meta-label">Time:</span><strong class="meta-val">${formatTime(kotDate)}</strong></div>
                <div class="thermal-meta-row"><span class="meta-label">Date:</span><span class="meta-val">${formatDate(kotDate)}</span></div>
                ${data.serverName ? `<div class="thermal-meta-row"><span class="meta-label">Server:</span><span class="meta-val">${data.serverName}</span></div>` : ''}
            </div>

            <div class="thermal-divider double"></div>

            <div class="kot-items-container">
                ${itemsHTML}
            </div>

            <div class="thermal-divider solid"></div>

            <div class="thermal-meta-row kot-summary-row">
                <span>TOTAL ITEMS:</span>
                <strong>${totalItemsCount} ITEMS</strong>
            </div>

            <div class="thermal-footer kot-footer">
                <div>*** END OF KOT ***</div>
            </div>
        </div>

        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                color: #000000 !important;
                -webkit-font-smoothing: antialiased;
            }

            .thermal-kot-doc {
                width: 76mm;
                max-width: 80mm;
                margin: 0 auto;
                background: #ffffff;
                font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
                font-size: 13px;
                line-height: 1.35;
                font-weight: 700;
                padding: 3mm 2mm;
                color: #000000 !important;
            }

            @media print {
                @page { margin: 0; size: 80mm auto; }
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                }
            }

            .thermal-divider.solid { border-top: 1.5px solid #000; margin: 6px 0; }
            .thermal-divider.double { border-top: 3px double #000; margin: 6px 0; }

            .thermal-center {
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }

            .kot-header-tag { font-size: 16px; font-weight: 900; letter-spacing: 0.05em; }

            .kot-table-banner {
                margin: 4px 0;
                padding: 4px 8px;
                border: 2px solid #000;
                width: 100%;
                text-align: center;
            }

            .kot-table-name { font-size: 18px; font-weight: 900; }
            .kot-type-pill { font-size: 12px; font-weight: 800; }

            .thermal-meta-list { display: flex; flex-direction: column; gap: 2px; }
            .thermal-meta-row { display: flex; justify-content: space-between; font-size: 12px; }
            .meta-label { font-weight: 700; }
            .meta-val { font-weight: 800; }

            .kot-items-container { display: flex; flex-direction: column; gap: 8px; margin: 6px 0; }
            .kot-item-card { display: flex; gap: 8px; align-items: baseline; }
            .kot-qty-badge { font-size: 16px; font-weight: 900; min-width: 44px; }
            .kot-item-details { flex: 1; display: flex; flex-direction: column; gap: 1px; }
            .kot-item-name { font-size: 15px; font-weight: 900; line-height: 1.25; }
            .kot-addon { font-size: 11px; font-weight: 700; }
            .kot-special-note { font-size: 12px; font-weight: 900; text-decoration: underline; margin-top: 2px; }
            .kot-summary-row { font-size: 14px; font-weight: 900; padding: 4px 0; }
            .kot-footer { text-align: center; font-size: 11px; font-weight: 800; margin-top: 10px; }
        </style>
    `;
}

export default generateKOT;
