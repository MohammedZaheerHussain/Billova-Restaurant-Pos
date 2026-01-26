// KOT (Kitchen Order Ticket) Template Generator
// Creates formatted KOT for kitchen printers

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
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';

    // Items
    items: KOTItem[];

    // Metadata
    createdAt: Date;
    serverName?: string;
    priority?: 'NORMAL' | 'RUSH' | 'VIP';

    // Special instructions
    orderNotes?: string;
}

export function generateKOT(data: KOTData, printerWidth: 48 | 32 = 48): ESCPOSEncoder {
    const encoder = new ESCPOSEncoder({ width: printerWidth });

    encoder.initialize();

    // ==================== HEADER ====================
    encoder.align(TextAlign.CENTER);

    // KOT Title (large, inverted for visibility)
    encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);

    // Priority indicator
    if (data.priority === 'RUSH') {
        encoder.invert(true);
        encoder.line(' * RUSH ORDER * ');
        encoder.invert(false);
    } else if (data.priority === 'VIP') {
        encoder.invert(true);
        encoder.line(' ** VIP ** ');
        encoder.invert(false);
    }

    // Order Type Header
    const orderTypeLabels: Record<string, string> = {
        'DINE_IN': 'DINE IN',
        'TAKEAWAY': 'PARCEL',
        'DELIVERY': 'DELIVERY',
        'ONLINE': 'ONLINE',
    };
    encoder.line(orderTypeLabels[data.orderType] || data.orderType);

    // Table/Counter
    if (data.tableName || data.orderType === 'DINE_IN') {
        encoder.line(data.tableName || 'Counter');
    }

    encoder.setFontSize(FontSize.NORMAL).bold(false);
    encoder.divider('=');
    encoder.align(TextAlign.LEFT);

    // ==================== ORDER INFO ====================
    const kotDate = new Date(data.createdAt);

    encoder.bold(true);
    encoder.printRow('KOT No:', String(data.kotNumber));
    encoder.bold(false);

    if (data.orderNumber) {
        encoder.printRow('Order:', String(data.orderNumber));
    }

    encoder.printRow('Time:', kotDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }));

    if (data.serverName) {
        encoder.printRow('Server:', data.serverName);
    }

    encoder.divider('-');

    // ==================== ITEMS ====================
    encoder.bold(true).setFontSize(FontSize.DOUBLE_BOTH);

    for (const item of data.items) {
        // Quantity and Item Name (LARGE for kitchen visibility)
        const qtyStr = `${item.quantity}x `;
        let itemName = item.name;

        // Truncate long names
        const maxLen = printerWidth >= 48 ? 18 : 12;
        if (itemName.length > maxLen) {
            itemName = itemName.substring(0, maxLen - 1) + '…';
        }

        encoder.line(qtyStr + itemName);

        encoder.setFontSize(FontSize.DOUBLE_HEIGHT).bold(false);

        // Veg indicator
        if (item.isVeg !== undefined) {
            encoder.text(item.isVeg ? '  [VEG]' : '  [NON-VEG]');
            encoder.feed(1);
        }

        // Variant
        if (item.variant) {
            encoder.line(`  > ${item.variant}`);
        }

        // Addons
        if (item.addons && item.addons.length > 0) {
            for (const addon of item.addons) {
                encoder.line(`  + ${addon}`);
            }
        }

        // Notes (highlighted)
        if (item.notes) {
            encoder.bold(true).underline(true);
            encoder.line(`  ** ${item.notes.toUpperCase()} **`);
            encoder.bold(false).underline(false);
        }

        encoder.setFontSize(FontSize.DOUBLE_BOTH).bold(true);
        encoder.feed(1);
    }

    encoder.setFontSize(FontSize.NORMAL).bold(false);

    // ==================== ORDER NOTES ====================
    if (data.orderNotes) {
        encoder.divider('-');
        encoder.bold(true);
        encoder.line('SPECIAL INSTRUCTIONS:');
        encoder.bold(false);
        encoder.line(data.orderNotes);
    }

    // ==================== FOOTER ====================
    encoder.divider('=');
    encoder.align(TextAlign.CENTER);

    // Timestamp for verification
    encoder.line(`Printed: ${kotDate.toLocaleString('en-IN')}`);

    // Cut paper
    encoder.cut(CutType.PARTIAL);

    // Beep to alert kitchen
    encoder.beep(2, 100);

    return encoder;
}

// Generate HTML KOT for browser printing
export function generateKOTHTML(data: KOTData): string {
    const orderTypeLabels: Record<string, string> = {
        'DINE_IN': 'DINE IN',
        'TAKEAWAY': 'PARCEL',
        'DELIVERY': 'DELIVERY',
        'ONLINE': 'ONLINE',
    };

    const formatTime = (date: Date) => new Date(date).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    const itemsHTML = data.items.map(item => {
        const addonsHTML = item.addons ? item.addons.map(a => `<div class="addon">+ ${a}</div>`).join('') : '';
        const notesHTML = item.notes ? `<div class="note">** ${item.notes.toUpperCase()} **</div>` : '';
        const vegBadge = item.isVeg !== undefined
            ? `<span class="veg-badge ${item.isVeg ? 'veg' : 'nonveg'}">${item.isVeg ? 'VEG' : 'NON-VEG'}</span>`
            : '';

        return `
            <div class="kot-item">
                <div class="qty">${item.quantity}x</div>
                <div class="details">
                    <div class="name">${item.name} ${vegBadge}</div>
                    ${item.variant ? `<div class="variant">&gt; ${item.variant}</div>` : ''}
                    ${addonsHTML}
                    ${notesHTML}
                </div>
            </div>
        `;
    }).join('');

    const priorityClass = data.priority?.toLowerCase() || 'normal';

    return `
        <div class="kot ${priorityClass}">
            <div class="header">
                ${data.priority === 'RUSH' ? '<div class="priority rush">* RUSH ORDER *</div>' : ''}
                ${data.priority === 'VIP' ? '<div class="priority vip">** VIP **</div>' : ''}
                <h1>${orderTypeLabels[data.orderType] || data.orderType}</h1>
                <h2>${data.tableName || 'Counter'}</h2>
            </div>

            <div class="divider"></div>

            <div class="info">
                <div class="row"><span>KOT No:</span><strong>${data.kotNumber}</strong></div>
                ${data.orderNumber ? `<div class="row"><span>Order:</span><span>${data.orderNumber}</span></div>` : ''}
                <div class="row"><span>Time:</span><span>${formatTime(data.createdAt)}</span></div>
                ${data.serverName ? `<div class="row"><span>Server:</span><span>${data.serverName}</span></div>` : ''}
            </div>

            <div class="divider"></div>

            <div class="items">
                ${itemsHTML}
            </div>

            ${data.orderNotes ? `
                <div class="divider dashed"></div>
                <div class="order-notes">
                    <strong>SPECIAL INSTRUCTIONS:</strong>
                    <p>${data.orderNotes}</p>
                </div>
            ` : ''}

            <div class="divider"></div>
            <div class="footer">
                Printed: ${new Date(data.createdAt).toLocaleString('en-IN')}
            </div>
        </div>

        <style>
            .kot {
                font-family: 'Courier New', monospace;
                font-size: 14px;
                width: 80mm;
                padding: 5mm;
                background: #fff;
            }
            .kot.rush { border: 3px solid #f00; }
            .kot.vip { border: 3px solid #ffd700; }
            .header { text-align: center; }
            .header h1 { font-size: 28px; margin: 5px 0; }
            .header h2 { font-size: 24px; margin: 5px 0; }
            .priority { 
                font-size: 18px; font-weight: bold; 
                padding: 5px; margin-bottom: 5px;
            }
            .priority.rush { background: #f00; color: #fff; }
            .priority.vip { background: #ffd700; color: #000; }
            .divider { border-top: 2px solid #000; margin: 10px 0; }
            .divider.dashed { border-style: dashed; }
            .info .row { display: flex; justify-content: space-between; }
            .kot-item { 
                display: flex; gap: 10px; 
                margin: 15px 0; 
                font-size: 20px;
                font-weight: bold;
            }
            .kot-item .qty { font-size: 24px; min-width: 40px; }
            .kot-item .name { font-size: 22px; }
            .variant, .addon { font-size: 16px; font-weight: normal; padding-left: 5px; }
            .note { 
                font-size: 16px; font-weight: bold; 
                text-decoration: underline; 
                background: #ff0; 
                padding: 2px 5px;
                margin-top: 5px;
            }
            .veg-badge { 
                font-size: 10px; 
                padding: 1px 4px; 
                border-radius: 3px;
                margin-left: 5px;
            }
            .veg-badge.veg { background: #0a0; color: #fff; }
            .veg-badge.nonveg { background: #c00; color: #fff; }
            .order-notes { background: #ffc; padding: 10px; }
            .footer { text-align: center; font-size: 12px; color: #666; }
        </style>
    `;
}

export default generateKOT;
