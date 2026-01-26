// ESC/POS Command Encoder for Thermal Printers
// Supports: Epson, Star, Bixolon, Citizen, and most ESC/POS compatible printers

export enum TextAlign {
    LEFT = 0,
    CENTER = 1,
    RIGHT = 2,
}

export enum FontSize {
    NORMAL = 0,
    DOUBLE_WIDTH = 1,
    DOUBLE_HEIGHT = 2,
    DOUBLE_BOTH = 3,
}

export enum CutType {
    FULL = 0,
    PARTIAL = 1,
}

export interface PrinterConfig {
    width: number;           // Characters per line (48 for 80mm, 32 for 58mm)
    encoding: 'utf-8' | 'cp437' | 'cp850' | 'cp866';
    codePage?: number;
}

// ESC/POS Command constants
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;
const NUL = 0x00;
// Reserved for future use: CR = 0x0D, HT = 0x09

export class ESCPOSEncoder {
    private buffer: number[] = [];
    private config: PrinterConfig;

    constructor(config: Partial<PrinterConfig> = {}) {
        this.config = {
            width: config.width || 48,  // Default 80mm printer
            encoding: config.encoding || 'utf-8',
            codePage: config.codePage,
        };
    }

    // ==================== INITIALIZATION ====================

    /**
     * Initialize printer - reset to default settings
     */
    initialize(): this {
        this.buffer.push(ESC, 0x40); // ESC @
        return this;
    }

    /**
     * Set character code page
     */
    setCodePage(page: number = 0): this {
        this.buffer.push(ESC, 0x74, page); // ESC t n
        return this;
    }

    // ==================== TEXT FORMATTING ====================

    /**
     * Set text alignment
     */
    align(alignment: TextAlign): this {
        this.buffer.push(ESC, 0x61, alignment); // ESC a n
        return this;
    }

    /**
     * Set font size
     */
    setFontSize(size: FontSize): this {
        let n = 0x00;
        switch (size) {
            case FontSize.DOUBLE_WIDTH:
                n = 0x10;
                break;
            case FontSize.DOUBLE_HEIGHT:
                n = 0x01;
                break;
            case FontSize.DOUBLE_BOTH:
                n = 0x11;
                break;
        }
        this.buffer.push(GS, 0x21, n); // GS ! n
        return this;
    }

    /**
     * Set bold text
     */
    bold(enabled: boolean = true): this {
        this.buffer.push(ESC, 0x45, enabled ? 1 : 0); // ESC E n
        return this;
    }

    /**
     * Set underline
     */
    underline(enabled: boolean = true): this {
        this.buffer.push(ESC, 0x2D, enabled ? 1 : 0); // ESC - n
        return this;
    }

    /**
     * Invert colors (white on black)
     */
    invert(enabled: boolean = true): this {
        this.buffer.push(GS, 0x42, enabled ? 1 : 0); // GS B n
        return this;
    }

    /**
     * Reset text formatting to default
     */
    resetFormatting(): this {
        this.bold(false);
        this.underline(false);
        this.invert(false);
        this.setFontSize(FontSize.NORMAL);
        this.align(TextAlign.LEFT);
        return this;
    }

    // ==================== TEXT PRINTING ====================

    /**
     * Print text
     */
    text(content: string): this {
        const bytes = this.encodeText(content);
        this.buffer.push(...bytes);
        return this;
    }

    /**
     * Print text and add new line
     */
    line(content: string = ''): this {
        this.text(content);
        this.buffer.push(LF);
        return this;
    }

    /**
     * Print multiple new lines
     */
    feed(lines: number = 1): this {
        for (let i = 0; i < lines; i++) {
            this.buffer.push(LF);
        }
        return this;
    }

    /**
     * Print text with left and right parts (for receipts)
     * Example: printRow("Item Name", "₹100.00")
     */
    printRow(left: string, right: string, fillChar: string = ' '): this {
        const totalWidth = this.config.width;
        const rightLen = right.length;
        const leftMaxLen = totalWidth - rightLen - 1;

        let leftPart = left;
        if (leftPart.length > leftMaxLen) {
            leftPart = leftPart.substring(0, leftMaxLen);
        }

        const fillCount = totalWidth - leftPart.length - rightLen;
        const fill = fillChar.repeat(Math.max(0, fillCount));

        return this.line(leftPart + fill + right);
    }

    /**
     * Print a horizontal line/divider
     */
    divider(char: string = '-'): this {
        return this.line(char.repeat(this.config.width));
    }

    /**
     * Print centered text
     */
    centerText(content: string): this {
        return this.align(TextAlign.CENTER).line(content).align(TextAlign.LEFT);
    }

    // ==================== SPECIAL CHARACTERS ====================

    /**
     * Print Indian Rupee symbol (₹)
     * Some printers may not support this - use fallback
     */
    rupee(amount: number | string): string {
        return `Rs.${amount}`;  // Use "Rs." for maximum compatibility
    }

    // ==================== PAPER CONTROL ====================

    /**
     * Cut paper
     */
    cut(type: CutType = CutType.PARTIAL): this {
        this.feed(3);  // Feed before cut
        if (type === CutType.FULL) {
            this.buffer.push(GS, 0x56, 0x00); // GS V 0 (full cut)
        } else {
            this.buffer.push(GS, 0x56, 0x01); // GS V 1 (partial cut)
        }
        return this;
    }

    /**
     * Open cash drawer
     */
    openCashDrawer(pin: 2 | 5 = 2): this {
        // ESC p m t1 t2 - Generate pulse
        const m = pin === 2 ? 0 : 1;
        this.buffer.push(ESC, 0x70, m, 25, 250);
        return this;
    }

    /**
     * Beep (buzzer)
     */
    beep(times: number = 1, duration: number = 100): this {
        // ESC B n t
        this.buffer.push(ESC, 0x42, times, Math.floor(duration / 50));
        return this;
    }

    // ==================== BARCODE ====================

    /**
     * Print barcode
     */
    barcode(data: string, type: 'CODE39' | 'CODE128' | 'EAN13' = 'CODE128'): this {
        // Set barcode height
        this.buffer.push(GS, 0x68, 80); // GS h n (height = 80 dots)

        // Set barcode width
        this.buffer.push(GS, 0x77, 2); // GS w n (width = 2)

        // Set HRI position (below barcode)
        this.buffer.push(GS, 0x48, 2); // GS H n (2 = below)

        // Print barcode
        let m: number;
        switch (type) {
            case 'CODE39':
                m = 4;
                break;
            case 'CODE128':
                m = 73;
                break;
            case 'EAN13':
                m = 2;
                break;
            default:
                m = 73;
        }

        this.buffer.push(GS, 0x6B, m);
        const bytes = this.encodeText(data);
        this.buffer.push(...bytes, NUL);

        return this;
    }

    // ==================== QR CODE ====================

    /**
     * Print QR code
     */
    qrcode(data: string, size: number = 6): this {
        const bytes = this.encodeText(data);
        const len = bytes.length + 3;
        const pL = len % 256;
        const pH = Math.floor(len / 256);

        // Set QR model (Model 2)
        this.buffer.push(GS, 0x28, 0x6B, 4, 0, 49, 65, 50, 0);

        // Set QR size (1-16, default 6)
        this.buffer.push(GS, 0x28, 0x6B, 3, 0, 49, 67, Math.min(Math.max(size, 1), 16));

        // Set error correction level (L=48, M=49, Q=50, H=51)
        this.buffer.push(GS, 0x28, 0x6B, 3, 0, 49, 69, 49);

        // Store QR data
        this.buffer.push(GS, 0x28, 0x6B, pL, pH, 49, 80, 48);
        this.buffer.push(...bytes);

        // Print QR code
        this.buffer.push(GS, 0x28, 0x6B, 3, 0, 49, 81, 48);

        return this;
    }

    // ==================== IMAGE/LOGO PRINTING ====================

    /**
     * Print a monochrome image/logo from base64 data
     * Image should be pre-processed to monochrome bitmap
     * @param imageData - Base64 encoded monochrome bitmap data
     * @param width - Image width in pixels (should be multiple of 8)
     * @param height - Image height in pixels
     */
    image(imageData: string, width: number, height: number): this {
        try {
            // Decode base64 to bytes
            const binaryString = atob(imageData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Calculate bytes per line (width / 8)
            const bytesPerLine = Math.ceil(width / 8);
            const xL = bytesPerLine % 256;
            const xH = Math.floor(bytesPerLine / 256);
            const yL = height % 256;
            const yH = Math.floor(height / 256);

            // GS v 0 - Print raster bit image
            // Format: GS v 0 m xL xH yL yH d1...dk
            // m = 0: Normal mode
            this.buffer.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);
            this.buffer.push(...Array.from(bytes));

            return this;
        } catch (error) {
            console.error('[ESCPOSEncoder] Image print error:', error);
            return this;
        }
    }

    /**
     * Print logo from canvas/image data
     * Converts to monochrome bitmap suitable for thermal printing
     */
    async printLogo(imageUrl: string, maxWidth: number = 384): Promise<this> {
        try {
            const { data, width, height } = await this.processImageForPrinting(imageUrl, maxWidth);
            return this.image(data, width, height);
        } catch (error) {
            console.error('[ESCPOSEncoder] Logo print error:', error);
            return this;
        }
    }

    /**
     * Process image for thermal printing
     * Converts to monochrome bitmap
     */
    private async processImageForPrinting(
        imageUrl: string,
        maxWidth: number
    ): Promise<{ data: string; width: number; height: number }> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                // Calculate dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.floor((height * maxWidth) / width);
                    width = maxWidth;
                }

                // Make width a multiple of 8
                width = Math.floor(width / 8) * 8;

                // Create canvas for processing
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d')!;

                // Draw image
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Get image data
                const imageData = ctx.getImageData(0, 0, width, height);
                const pixels = imageData.data;

                // Convert to monochrome bitmap
                const bytesPerLine = width / 8;
                const bitmapData = new Uint8Array(bytesPerLine * height);

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pixelIndex = (y * width + x) * 4;
                        const r = pixels[pixelIndex];
                        const g = pixels[pixelIndex + 1];
                        const b = pixels[pixelIndex + 2];

                        // Convert to grayscale and threshold
                        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                        const isBlack = gray < 128;

                        if (isBlack) {
                            const byteIndex = y * bytesPerLine + Math.floor(x / 8);
                            const bitIndex = 7 - (x % 8);
                            bitmapData[byteIndex] |= (1 << bitIndex);
                        }
                    }
                }

                // Convert to base64
                let binaryString = '';
                for (let i = 0; i < bitmapData.length; i++) {
                    binaryString += String.fromCharCode(bitmapData[i]);
                }
                const base64Data = btoa(binaryString);

                resolve({ data: base64Data, width, height });
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageUrl;
        });
    }

    // ==================== OUTPUT ====================

    /**
     * Get the encoded buffer as Uint8Array
     */
    encode(): Uint8Array {
        return new Uint8Array(this.buffer);
    }

    /**
     * Get buffer as base64 string (for web APIs)
     */
    toBase64(): string {
        const uint8 = this.encode();
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        return btoa(binary);
    }

    /**
     * Get buffer length
     */
    getLength(): number {
        return this.buffer.length;
    }

    /**
     * Clear buffer and start fresh
     */
    clear(): this {
        this.buffer = [];
        return this;
    }

    // ==================== PRIVATE HELPERS ====================

    private encodeText(text: string): number[] {
        // Convert string to bytes using TextEncoder
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        return Array.from(bytes);
    }
}

// Factory function for common printer widths
export function createEncoder80mm(): ESCPOSEncoder {
    return new ESCPOSEncoder({ width: 48 });
}

export function createEncoder58mm(): ESCPOSEncoder {
    return new ESCPOSEncoder({ width: 32 });
}

export default ESCPOSEncoder;
