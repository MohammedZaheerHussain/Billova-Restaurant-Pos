// Customer Self-Order API Routes (Supabase - No Auth Required)
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Generate unique session token
const generateToken = () => crypto.randomBytes(16).toString('hex');

// Get menu for QR session
router.get('/menu/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        // Find table by QR token
        const { data: table, error } = await supabase
            .from('tables')
            .select('*, branches (id, name, phone)')
            .eq('qr_token', token)
            .single();

        if (error || !table) {
            return res.status(404).json({ error: 'Invalid QR code' });
        }

        // Fetch categories
        const { data: categories } = await supabase
            .from('categories')
            .select('*')
            .eq('branch_id', table.branch_id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        // Fetch menu items
        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('*, menu_item_variants (*), categories (name)')
            .eq('branch_id', table.branch_id)
            .eq('is_available', true)
            .order('sort_order', { ascending: true });

        res.json({
            table: { id: table.id, name: table.name },
            branch: table.branches,
            categories: categories || [],
            menuItems: menuItems || [],
        });
    } catch (error) {
        logger.error('Error fetching menu:', error);
        res.status(500).json({ error: 'Failed to load menu' });
    }
});

// Get branch info by ID (for public menu)
router.get('/branch/:branchId', async (req: Request, res: Response) => {
    try {
        const { branchId } = req.params;

        const { data: branch, error } = await supabase
            .from('branches')
            .select('id, name, phone, address, gst_number')
            .eq('id', branchId)
            .single();

        if (error || !branch) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        res.json({
            id: branch.id,
            name: branch.name,
            phone: branch.phone,
            address: branch.address,
            gstNumber: branch.gst_number,
        });
    } catch (error) {
        logger.error('Error fetching branch:', error);
        res.status(500).json({ error: 'Failed to load restaurant info' });
    }
});

// Get full menu for a branch (public access)
router.get('/menu-full/:branchId', async (req: Request, res: Response) => {
    try {
        const { branchId } = req.params;

        const { data: branch, error: branchError } = await supabase
            .from('branches')
            .select('id, name, phone, address')
            .eq('id', branchId)
            .single();

        if (branchError || !branch) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const { data: categories } = await supabase
            .from('categories')
            .select('*')
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('*, menu_item_variants (*), categories (id, name, icon)')
            .eq('branch_id', branchId)
            .eq('is_available', true)
            .order('sort_order', { ascending: true });

        res.json({ branch, categories: categories || [], menuItems: menuItems || [] });
    } catch (error) {
        logger.error('Error fetching full menu:', error);
        res.status(500).json({ error: 'Failed to load menu' });
    }
});

// Get order status for tracking
router.get('/order-status/:orderId', async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        const { data: order, error } = await supabase
            .from('orders')
            .select('*, order_items (*, menu_items (name))')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            orderNumber: order.order_number,
            status: order.status,
            orderType: order.order_type,
            customerName: order.customer_name || 'Guest',
            total: Number(order.total),
            createdAt: order.created_at,
            items: (order.order_items || []).map((item: any) => ({
                name: item.menu_items?.name || 'Unknown',
                quantity: item.quantity,
            })),
        });
    } catch (error) {
        logger.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Failed to get order status' });
    }
});

// Submit customer order
router.post('/order', async (req: Request, res: Response) => {
    try {
        const { token, customerName, items } = req.body;

        if (!token || !items || items.length === 0) {
            return res.status(400).json({ error: 'Token and items are required' });
        }

        // Find table by QR token
        const { data: table, error: tableError } = await supabase
            .from('tables')
            .select('*, branches (*)')
            .eq('qr_token', token)
            .single();

        if (tableError || !table) {
            return res.status(404).json({ error: 'Invalid QR code' });
        }

        // Calculate order totals
        let subtotal = 0;
        const orderItems: any[] = [];

        for (const item of items) {
            const { data: menuItem } = await supabase
                .from('menu_items')
                .select('*, menu_item_variants (*)')
                .eq('id', item.menuItemId)
                .single();

            if (!menuItem) continue;

            const price = item.variantId
                ? menuItem.menu_item_variants?.find((v: any) => v.id === item.variantId)?.price || menuItem.price
                : menuItem.price;

            const itemTotal = Number(price) * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                menu_item_id: item.menuItemId,
                variant_id: item.variantId || null,
                quantity: item.quantity,
                unit_price: price,
                total: itemTotal,
                notes: item.notes || null,
            });
        }

        // Get next order number
        const { data: lastOrders } = await supabase
            .from('orders')
            .select('order_number')
            .eq('branch_id', table.branch_id)
            .order('order_number', { ascending: false })
            .limit(1);

        const orderNumber = (lastOrders?.[0]?.order_number || 0) + 1;

        // Create order (using a dummy system user ID)
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                branch_id: table.branch_id,
                table_id: table.id,
                order_number: orderNumber,
                order_type: 'DINE_IN',
                status: 'PENDING',
                customer_name: customerName || 'Guest',
                notes: 'Self-order via QR',
                subtotal,
                discount_amount: 0,
                gst_amount: 0,
                total: subtotal,
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // Create order items
        const itemsWithOrderId = orderItems.map(item => ({ ...item, order_id: order.id }));
        await supabase.from('order_items').insert(itemsWithOrderId);

        // Update table status
        await supabase
            .from('tables')
            .update({ status: 'OCCUPIED' })
            .eq('id', table.id);

        res.status(201).json({
            success: true,
            orderNumber,
            message: 'Order placed successfully! Your order will be prepared shortly.',
        });
    } catch (error) {
        logger.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// Submit online order (delivery/takeaway)
router.post('/online-order', async (req: Request, res: Response) => {
    try {
        const { branchId, orderType, customerName, customerPhone, customerAddress, items } = req.body;

        if (!branchId || !items || items.length === 0) {
            return res.status(400).json({ error: 'Branch and items are required' });
        }

        if (!customerName || !customerPhone) {
            return res.status(400).json({ error: 'Customer name and phone are required' });
        }

        // Verify branch exists
        const { data: branch, error: branchError } = await supabase
            .from('branches')
            .select('id')
            .eq('id', branchId)
            .single();

        if (branchError || !branch) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Calculate order totals
        let subtotal = 0;
        const orderItems: any[] = [];

        for (const item of items) {
            const { data: menuItem } = await supabase
                .from('menu_items')
                .select('*, menu_item_variants (*)')
                .eq('id', item.menuItemId)
                .single();

            if (!menuItem) continue;

            const price = item.variantId
                ? menuItem.menu_item_variants?.find((v: any) => v.id === item.variantId)?.price || menuItem.price
                : menuItem.price;

            const itemTotal = Number(price) * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                menu_item_id: item.menuItemId,
                variant_id: item.variantId || null,
                quantity: item.quantity,
                unit_price: price,
                total: itemTotal,
                notes: item.notes || null,
            });
        }

        // Get next order number
        const { data: lastOrders } = await supabase
            .from('orders')
            .select('order_number')
            .eq('branch_id', branchId)
            .order('order_number', { ascending: false })
            .limit(1);

        const orderNumber = (lastOrders?.[0]?.order_number || 0) + 1;

        // Create the order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                branch_id: branchId,
                order_number: orderNumber,
                order_type: orderType || 'DELIVERY',
                status: 'PENDING',
                subtotal,
                discount_amount: 0,
                gst_amount: 0,
                total: subtotal,
                customer_name: customerName,
                customer_phone: customerPhone,
                notes: customerAddress ? `Delivery: ${customerAddress}` : null,
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // Create order items
        const itemsWithOrderId = orderItems.map(item => ({ ...item, order_id: order.id }));
        await supabase.from('order_items').insert(itemsWithOrderId);

        res.status(201).json({
            success: true,
            orderId: order.id,
            orderNumber,
            message: orderType === 'DELIVERY'
                ? 'Order placed! We will call you for delivery updates.'
                : 'Order placed! We will call you when ready for pickup.',
        });
    } catch (error) {
        logger.error('Error creating online order:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

export default router;
