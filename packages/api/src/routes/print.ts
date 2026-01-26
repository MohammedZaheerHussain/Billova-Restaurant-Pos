// Print API Routes - Backend proxy for network printing
import { Router, Request, Response } from 'express';
import * as net from 'net';

const router = Router();

// Default ESC/POS port
const DEFAULT_ESCPOS_PORT = 9100;

// ==================== TEST PRINTER CONNECTION ====================
router.post('/test', async (req: Request, res: Response) => {
    const { host, port = DEFAULT_ESCPOS_PORT } = req.body;

    if (!host) {
        return res.status(400).json({ error: 'Host is required' });
    }

    try {
        const isConnected = await testConnection(host, port);
        res.json({ success: isConnected, host, port });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Connection test failed',
        });
    }
});

// ==================== PRINT TO NETWORK PRINTER ====================
router.post('/', async (req: Request, res: Response) => {
    const { host, port = DEFAULT_ESCPOS_PORT, data } = req.body;

    if (!host) {
        return res.status(400).json({ error: 'Host is required' });
    }

    if (!data) {
        return res.status(400).json({ error: 'Print data is required' });
    }

    try {
        // Decode base64 data
        const buffer = Buffer.from(data, 'base64');

        await sendToPrinter(host, port, buffer);

        console.log(`[PrintAPI] Sent ${buffer.length} bytes to ${host}:${port}`);
        res.json({ success: true, bytesWritten: buffer.length });
    } catch (error) {
        console.error(`[PrintAPI] Print error:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Print failed',
        });
    }
});

// ==================== DISCOVER PRINTERS ON NETWORK ====================
router.get('/discover', async (_req: Request, res: Response) => {
    // Note: Full network discovery requires mdns/bonjour or IP scanning
    // For now, we return an empty array - users configure manually
    // In production, you could integrate with `node-bonjour` for mDNS discovery

    const printers: { host: string; port: number; name: string }[] = [];

    // You could add known printers from database here
    // const dbPrinters = await prisma.printer.findMany({ where: { type: 'network' } });

    res.json(printers);
});

// ==================== PRINT RAW ESC/POS ====================
router.post('/raw', async (req: Request, res: Response) => {
    const { host, port = DEFAULT_ESCPOS_PORT, commands } = req.body;

    if (!host || !commands || !Array.isArray(commands)) {
        return res.status(400).json({ error: 'Host and commands array required' });
    }

    try {
        const buffer = Buffer.from(commands);
        await sendToPrinter(host, port, buffer);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Print failed',
        });
    }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Test TCP connection to printer
 */
function testConnection(host: string, port: number, timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, host);
    });
}

/**
 * Send data to network printer via TCP
 */
function sendToPrinter(host: string, port: number, data: Buffer, timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.write(data, (err) => {
                if (err) {
                    socket.destroy();
                    reject(err);
                } else {
                    // Give printer time to process before closing
                    setTimeout(() => {
                        socket.end();
                        resolve();
                    }, 500);
                }
            });
        });

        socket.on('error', (err) => {
            socket.destroy();
            reject(err);
        });

        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timed out'));
        });

        socket.connect(port, host);
    });
}

export default router;
