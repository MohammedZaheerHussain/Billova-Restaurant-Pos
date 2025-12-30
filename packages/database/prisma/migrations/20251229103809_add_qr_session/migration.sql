/*
  Warnings:

  - A unique constraint covering the columns `[qrToken]` on the table `tables` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `tables` ADD COLUMN `qrToken` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `qr_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `tableId` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `orderId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `qr_sessions_sessionToken_key`(`sessionToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `tables_qrToken_key` ON `tables`(`qrToken`);

-- AddForeignKey
ALTER TABLE `qr_sessions` ADD CONSTRAINT `qr_sessions_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `tables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
