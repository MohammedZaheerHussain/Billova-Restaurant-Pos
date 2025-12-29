// DFC POS Pro - Database Seed
// Seeds the database with DFC menu items from the menu card

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting DFC POS Pro database seed...');

    // ==================== CREATE BRANCH ====================
    const branch = await prisma.branch.create({
        data: {
            name: 'DFC - Main Branch',
            address: 'Vellore, Tamil Nadu',
            phone: '+91 9876543210',
            gstNumber: null, // Add GST number when ready
            isActive: true,
        },
    });
    console.log('✅ Branch created:', branch.name);

    // ==================== CREATE OWNER USER ====================
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const owner = await prisma.user.create({
        data: {
            branchId: branch.id,
            name: 'Owner',
            email: 'owner@dfc.com',
            phone: '+91 9876543210',
            password: hashedPassword,
            role: 'OWNER',
            isActive: true,
        },
    });
    console.log('✅ Owner user created:', owner.email);

    // ==================== CREATE CATEGORIES ====================
    const categories = await Promise.all([
        prisma.category.create({
            data: { branchId: branch.id, name: 'Fried Chicken', icon: '🍗', color: '#dc2626', sortOrder: 1 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Sandwich', icon: '🥪', color: '#f97316', sortOrder: 2 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Burger', icon: '🍔', color: '#eab308', sortOrder: 3 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Wrap / Roll', icon: '🌯', color: '#22c55e', sortOrder: 4 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Quick Bites', icon: '🍟', color: '#3b82f6', sortOrder: 5 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Momos', icon: '🥟', color: '#8b5cf6', sortOrder: 6 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Mojitos', icon: '🍹', color: '#06b6d4', sortOrder: 7 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Shawarma', icon: '🥙', color: '#ec4899', sortOrder: 8 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Addons', icon: '➕', color: '#6b7280', sortOrder: 9 },
        }),
        prisma.category.create({
            data: { branchId: branch.id, name: 'Combos', icon: '🎁', color: '#f59e0b', sortOrder: 10 },
        }),
    ]);

    const [
        friedChicken,
        sandwich,
        burger,
        wrapRoll,
        quickBites,
        momos,
        mojitos,
        shawarma,
        addons,
        combos,
    ] = categories;

    console.log('✅ Categories created:', categories.length);

    // ==================== CREATE MENU ITEMS ====================

    // ----- FRIED CHICKEN -----
    const friedChickenItems = [
        {
            name: 'Lollipop',
            description: 'Juicy, crispy, and bursting with savory, tangy flavors',
            price: 100,
            isVeg: false,
            variants: [
                { name: '6 PCS', price: 100, isDefault: true },
                { name: '8 PCS', price: 150, isDefault: false },
            ],
        },
        {
            name: 'Wings',
            description: 'Crispy, juicy, and packed with bold, savory flavors',
            price: 100,
            isVeg: false,
            variants: [{ name: '6 PCS', price: 100, isDefault: true }],
        },
        {
            name: 'Popcorn',
            description: 'Bite-sized, crispy, and loaded with flavorful goodness',
            price: 120,
            isVeg: false,
            variants: [{ name: 'Regular', price: 120, isDefault: true }],
        },
        {
            name: 'Strips',
            description: 'Tender, crispy, and bursting with savory spices',
            price: 130,
            isVeg: false,
            variants: [{ name: '6 PCS', price: 130, isDefault: true }],
        },
        {
            name: 'Fried Leg Piece',
            description: 'Juicy, crispy, and full of bold, savory flavors',
            price: 60,
            isVeg: false,
            variants: [
                { name: '1 PC', price: 60, isDefault: true },
                { name: '2 PCS', price: 110, isDefault: false },
            ],
        },
        {
            name: 'Hot & Crispy Mini Bucket',
            description: 'Crispy, juicy, and packed with bold flavors',
            price: 249,
            isVeg: false,
            variants: [{ name: '4 PCS', price: 249, isDefault: true }],
        },
        {
            name: 'Hot & Crispy Family Bucket',
            description: 'A perfect mix of crispy, savory chicken, bursting with bold flavors',
            price: 349,
            isVeg: false,
            variants: [{ name: '6 PCS', price: 349, isDefault: true }],
        },
        {
            name: 'Hot & Crispy Big Bucket',
            description: 'A feast of crispy, juicy chicken, packed with bold flavors',
            price: 499,
            isVeg: false,
            variants: [{ name: '8 PCS', price: 499, isDefault: true }],
        },
    ];

    for (const item of friedChickenItems) {
        const menuItem = await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: friedChicken.id,
                name: item.name,
                description: item.description,
                price: item.price,
                isVeg: item.isVeg,
                variants: {
                    create: item.variants,
                },
            },
        });
    }

    // ----- SANDWICH -----
    const sandwichItems = [
        { name: 'Veg Sandwich', price: 60, isVeg: true },
        { name: 'Paneer Sandwich', price: 70, isVeg: true },
        {
            name: 'Fried Chicken Sandwich',
            price: 80,
            isVeg: false,
            description: 'Crispy fried chicken and fresh veggies',
        },
    ];

    for (const item of sandwichItems) {
        await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: sandwich.id,
                name: item.name,
                description: item.description || null,
                price: item.price,
                isVeg: item.isVeg,
            },
        });
    }

    // ----- BURGER -----
    const burgerItems = [
        {
            name: 'Veg Burger',
            price: 60,
            isVeg: true,
            description: 'Crispy veggie patty, soft buns, and fresh toppings',
            variants: [
                { name: 'Regular', price: 60, isDefault: true },
                { name: 'Large', price: 100, isDefault: false },
            ],
        },
        {
            name: 'No Bun Burger',
            price: 160,
            isVeg: false,
            description: 'Juicy patties, fresh veggies, and bold flavors',
        },
        {
            name: 'Fried Chicken Burger',
            price: 130,
            isVeg: false,
            description: 'Crispy fried chicken, soft buns, and savory toppings',
            variants: [
                { name: 'Regular', price: 130, isDefault: true },
                { name: 'Large', price: 150, isDefault: false },
            ],
        },
        {
            name: 'Fried Chicken Duo Tower Burger',
            price: 180,
            isVeg: false,
            description: 'Two crispy fried chicken patties with cheese',
            variants: [
                { name: 'Regular', price: 180, isDefault: true },
                { name: 'Large', price: 200, isDefault: false },
            ],
        },
    ];

    for (const item of burgerItems) {
        await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: burger.id,
                name: item.name,
                description: item.description,
                price: item.price,
                isVeg: item.isVeg,
                variants: item.variants ? { create: item.variants } : undefined,
            },
        });
    }

    // ----- WRAP / ROLL -----
    const wrapItems = [
        {
            name: 'Veg Wrap',
            price: 80,
            isVeg: true,
            variants: [
                { name: 'Single', price: 80, isDefault: true },
                { name: 'Double', price: 100, isDefault: false },
            ],
        },
        {
            name: 'Paneer Wrap',
            price: 90,
            isVeg: true,
            variants: [
                { name: 'Single', price: 90, isDefault: true },
                { name: 'Double', price: 110, isDefault: false },
            ],
        },
        {
            name: 'Fried Chicken Wrap',
            price: 120,
            isVeg: false,
            variants: [
                { name: 'Single', price: 120, isDefault: true },
                { name: 'Double', price: 140, isDefault: false },
            ],
        },
    ];

    for (const item of wrapItems) {
        await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: wrapRoll.id,
                name: item.name,
                price: item.price,
                isVeg: item.isVeg,
                variants: item.variants ? { create: item.variants } : undefined,
            },
        });
    }

    // ----- QUICK BITES -----
    const quickBitesItems = [
        {
            name: 'French Fries',
            price: 59,
            isVeg: true,
            variants: [
                { name: 'Small', price: 59, isDefault: true },
                { name: 'Large', price: 99, isDefault: false },
            ],
        },
        {
            name: 'Peri Peri French Fries',
            price: 69,
            isVeg: true,
        },
        {
            name: 'Fried Chicken Loaded Fries',
            price: 179,
            isVeg: false,
            description: 'Crispy fries topped with juicy fried chicken',
        },
        {
            name: 'Chicken Burger',
            price: 60,
            isVeg: false,
            variants: [
                { name: 'Regular', price: 60, isDefault: true },
                { name: 'Large', price: 100, isDefault: false },
            ],
        },
    ];

    for (const item of quickBitesItems) {
        await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: quickBites.id,
                name: item.name,
                description: item.description || null,
                price: item.price,
                isVeg: item.isVeg,
                variants: item.variants ? { create: item.variants } : undefined,
            },
        });
    }

    // ----- MOMOS -----
    const momosItems = [
        {
            name: 'Chicken Momos',
            price: 80,
            isVeg: false,
            variants: [
                { name: '5 PCS', price: 80, isDefault: true },
                { name: '8 PCS', price: 90, isDefault: false },
            ],
        },
        {
            name: 'Paneer Momos',
            price: 90,
            isVeg: true,
            variants: [
                { name: '5 PCS', price: 90, isDefault: true },
                { name: '8 PCS', price: 80, isDefault: false },
            ],
        },
        {
            name: 'Chicken Schezwan Momos',
            price: 90,
            isVeg: false,
            variants: [
                { name: '5 PCS', price: 90, isDefault: true },
                { name: '8 PCS', price: 100, isDefault: false },
            ],
        },
    ];

    for (const item of momosItems) {
        await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: momos.id,
                name: item.name,
                price: item.price,
                isVeg: item.isVeg,
                variants: item.variants ? { create: item.variants } : undefined,
            },
        });
    }

    // ----- MOJITOS -----
    const mojitosItems = [
        { name: 'Blue Curacao', price: 79, isVeg: true },
        { name: 'Limit Limit', price: 79, isVeg: true },
        { name: 'Green Apple', price: 79, isVeg: true },
        { name: 'Blueberry', price: 79, isVeg: true },
    ];

    for (const item of mojitosItems) {
        await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: mojitos.id,
                name: item.name,
                price: item.price,
                isVeg: item.isVeg,
            },
        });
    }

    // ----- SHAWARMA -----
    const shawarmaItems = [
        {
            name: 'Real Arabian Shawarma',
            price: 120,
            isVeg: false,
            description: 'Fresh veggies, soft bread, and bold flavors',
        },
        {
            name: 'Classic Shawarma',
            price: 80,
            isVeg: false,
        },
        {
            name: 'Fried Chicken Shawarma',
            price: 80,
            isVeg: false,
            variants: [
                { name: 'Regular', price: 80, isDefault: true },
                { name: 'Large', price: 120, isDefault: false },
            ],
        },
        {
            name: 'Mexican Spicy Shawarma',
            price: 90,
            isVeg: false,
            variants: [
                { name: 'Regular', price: 90, isDefault: true },
                { name: 'Large', price: 130, isDefault: false },
            ],
        },
        {
            name: 'Plate Shawarma',
            price: 140,
            isVeg: false,
            description: 'Golden, crispy, and perfectly seasoned',
        },
        {
            name: 'Labonese Shawarma',
            price: 90,
            isVeg: false,
            variants: [
                { name: 'Regular', price: 90, isDefault: true },
                { name: 'Large', price: 130, isDefault: false },
            ],
        },
    ];

    for (const item of shawarmaItems) {
        await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: shawarma.id,
                name: item.name,
                description: item.description || null,
                price: item.price,
                isVeg: item.isVeg,
                variants: item.variants ? { create: item.variants } : undefined,
            },
        });
    }

    // ----- ADDONS -----
    const addonsItems = [
        { name: 'Water Bottle', price: 20, isVeg: true },
        { name: 'Cheese Slice', price: 20, isVeg: true },
        { name: 'Mayo Eggless', price: 20, isVeg: true },
        { name: 'Tandoori Mayo', price: 20, isVeg: true },
        { name: 'Garlic Mayo', price: 20, isVeg: true },
        { name: 'Sauce Combo', price: 50, isVeg: true },
        { name: 'Cool Drinks', price: 20, isVeg: true },
        { name: 'Kubus', price: 10, isVeg: true },
    ];

    for (const item of addonsItems) {
        await prisma.menuItem.create({
            data: {
                branchId: branch.id,
                categoryId: addons.id,
                name: item.name,
                price: item.price,
                isVeg: item.isVeg,
            },
        });
    }

    console.log('✅ Menu items created');

    // ==================== CREATE COMBOS ====================
    const combosData = [
        {
            name: 'Combo Pack 1 - Solo Treat',
            price: 279,
            items: [
                'Fried Chicken Burger / Arabian Shawarma - 1',
                'Mojito - 1',
                'Chicken Popcorn Large - 1',
            ],
        },
        {
            name: 'Combo Pack 2 - Mixed Bucket',
            price: 279,
            items: ['Lollipop - 2 PCS', 'Wing - 2 PCS', 'Leg - 2 PCS'],
        },
        {
            name: 'Combo Pack 3 - Duo Feast',
            price: 449,
            items: [
                'Fried Chicken Sandwich (Cheese) - 1',
                'Fried Chicken Strips - 1',
                'Fried Chicken Loaded Fries - 1',
                'Mojito - 2',
            ],
        },
        {
            name: 'Combo Pack 4 - Family Pack',
            price: 649,
            items: [
                'Hot and Crispy Family Bucket - 6 PCS',
                'Peri Peri French Fries Large',
                'Classic Shawarma - 2',
                'Mojito - 2',
            ],
        },
    ];

    for (const combo of combosData) {
        await prisma.combo.create({
            data: {
                branchId: branch.id,
                name: combo.name,
                price: combo.price,
                items: {
                    create: combo.items.map((item) => ({ itemName: item })),
                },
            },
        });
    }

    console.log('✅ Combos created');

    // ==================== CREATE SAMPLE TABLES ====================
    const tables = [
        { name: 'T1', capacity: 2 },
        { name: 'T2', capacity: 2 },
        { name: 'T3', capacity: 4 },
        { name: 'T4', capacity: 4 },
        { name: 'T5', capacity: 4 },
        { name: 'T6', capacity: 6 },
        { name: 'T7', capacity: 6 },
        { name: 'T8', capacity: 8 },
    ];

    for (const table of tables) {
        await prisma.table.create({
            data: {
                branchId: branch.id,
                name: table.name,
                capacity: table.capacity,
                status: 'EMPTY',
            },
        });
    }

    console.log('✅ Tables created:', tables.length);

    console.log('\n🎉 DFC POS Pro database seeded successfully!');
    console.log('📧 Owner login: owner@dfc.com / admin123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
