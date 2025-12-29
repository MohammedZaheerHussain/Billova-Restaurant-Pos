/*
  Warnings:

  - The values [PRO,ENTERPRISE] on the enum `licenses_plan` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `licenses` MODIFY `plan` ENUM('BASIC', 'PLUS', 'PREMIUM') NOT NULL DEFAULT 'BASIC';
