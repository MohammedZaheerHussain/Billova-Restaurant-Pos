// Billova POS - API Server Entry Point
import dotenv from 'dotenv';
dotenv.config(); // Load env vars BEFORE other imports

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { supabase } from './lib/supabase';

// Import routes (after dotenv is loaded)
import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import categoryRoutes from './routes/categories';
import orderRoutes from './routes/orders';
import tableRoutes from './routes/tables';
import reportRoutes from './routes/reports';
import userRoutes from './routes/users';
import comboRoutes from './routes/combos';
import superAdminRoutes from './routes/super-admin';
import inventoryRoutes from './routes/inventory';
import inventoryReportsRoutes from './routes/inventory-reports';
import addonsRoutes from './routes/addons';
import customerOrderRoutes from './routes/customer-order';
import warehouseRoutes from './routes/warehouse';
import purchaseRequestRoutes from './routes/purchase-requests';
import deliveryRoutes from './routes/delivery';
import supplierRoutes from './routes/supplier';
import purchaseOrderRoutes from './routes/purchase-orders';
import adjustmentsRoutes from './routes/adjustments';
import printRoutes from './routes/print';
import dashboardRoutes from './routes/dashboard';
import { logger } from './lib/logger';


const app = express();
const PORT = process.env.PORT || 3002;

// Rate limiting configuration - adjusted for POS application usage
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window (increased from 100 for POS usage)
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 auth attempts per window (increased from 5)
    message: { error: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow CORS assets
}));
app.use(compression()); // Gzip compression
app.use(morgan('combined')); // Request logging

// CORS Configuration - support multiple origins
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5175')
    .split(',')
    .map(origin => origin.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);

// Make Supabase available to routes
app.use((req, res, next) => {
    (req as any).supabase = supabase;
    next();
});


// Deep Health Check
app.get('/api/health', async (req, res) => {
    const start = Date.now();
    let dbStatus = 'unknown';
    let dbLatency = -1;

    try {
        const dbStart = Date.now();
        const { error } = await supabase.from('branches').select('id').limit(1);
        dbLatency = Date.now() - dbStart;
        dbStatus = error ? 'error' : 'connected';
    } catch {
        dbStatus = 'unreachable';
    }

    const memUsage = process.memoryUsage();
    const healthy = dbStatus === 'connected';

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'degraded',
        version: '1.0.0',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        checks: {
            database: { status: dbStatus, latencyMs: dbLatency },
            memory: {
                heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
                rssMB: Math.round(memUsage.rss / 1024 / 1024),
            },
        },
        responseMs: Date.now() - start,
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory-reports', inventoryReportsRoutes);
app.use('/api/addons', addonsRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/adjustments', adjustmentsRoutes);
app.use('/api/print', printRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Public routes (no auth required)
app.use('/api/public', customerOrderRoutes);

// Standardized Error Handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // CORS errors
    if (err.message?.startsWith('CORS:')) {
        return res.status(403).json({
            error: 'Forbidden',
            message: err.message,
        });
    }

    // Log the error (keep console.error for server-side — not browser)
    logger.error(`[API Error] ${req.method} ${req.path}:`, err.message || err);

    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal server error' : err.message || 'Something went wrong',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});

// Start server
app.listen(PORT, () => {
    logger.debug(`
  🚀 Billova POS API Server
  ========================
  🌐 Server: http://localhost:${PORT}
  📊 Health: http://localhost:${PORT}/api/health
  🕐 Started: ${new Date().toLocaleString()}
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.debug('Shutting down gracefully...');
    process.exit(0);
});
