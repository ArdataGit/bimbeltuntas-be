/*
  Warnings:

  - Added the required column `parentCategoryId` to the `BankSoalCategory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `BankSoalCategory` ADD COLUMN `parentCategoryId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `BankSoalParentCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `value` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BankSoalParentCategory_value_key`(`value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BankSoalCategory` ADD CONSTRAINT `BankSoalCategory_parentCategoryId_fkey` FOREIGN KEY (`parentCategoryId`) REFERENCES `BankSoalParentCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
