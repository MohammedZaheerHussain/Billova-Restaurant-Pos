-- CreateTable
CREATE TABLE `menu_item_addons` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `category` VARCHAR(191) NOT NULL DEFAULT 'Extras',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_item_addon_links` (
    `id` VARCHAR(191) NOT NULL,
    `menuItemId` VARCHAR(191) NOT NULL,
    `addonId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `menu_item_addon_links_menuItemId_addonId_key`(`menuItemId`, `addonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_addons` (
    `id` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `addonId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `menu_item_addons` ADD CONSTRAINT `menu_item_addons_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_addon_links` ADD CONSTRAINT `menu_item_addon_links_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_addon_links` ADD CONSTRAINT `menu_item_addon_links_addonId_fkey` FOREIGN KEY (`addonId`) REFERENCES `menu_item_addons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_addons` ADD CONSTRAINT `order_item_addons_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_addons` ADD CONSTRAINT `order_item_addons_addonId_fkey` FOREIGN KEY (`addonId`) REFERENCES `menu_item_addons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
