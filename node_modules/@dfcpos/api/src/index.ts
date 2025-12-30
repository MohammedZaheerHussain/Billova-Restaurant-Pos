// DFC POS Pro - API Server Entry Point
import dotenv from 'dotenv';
dotenv.config(); // Load env vars BEFORE other imports

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

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


const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Make Prisma available to routes
app.use((req, res, next) => {
    (req as any).prisma = prisma;
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Billova API is running!' });
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

// Public routes (no auth required)
app.use('/api/public', customerOrderRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
  🚀 DFC POS Pro API Server
  ========================
  🌐 Server: http://localhost:${PORT}
  📊 Health: http://localhost:${PORT}/api/health
  🕐 Started: ${new Date().toLocaleString()}
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});
