/*
  Warnings:

  - You are about to drop the column `isMiniTest` on the `BankSoalCategory` table. All the data in the column will be lost.
  - You are about to drop the column `keterangan` on the `BankSoalCategory` table. All the data in the column will be lost.
  - You are about to drop the column `tipePenilaian` on the `BankSoalCategory` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `BankSoalParentCategory` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nama]` on the table `BankSoalParentCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nama` to the `BankSoalParentCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `BankSoalParentCategory_value_key` ON `BankSoalParentCategory`;

-- AlterTable
ALTER TABLE `BankSoalCategory` DROP COLUMN `isMiniTest`,
    DROP COLUMN `keterangan`,
    DROP COLUMN `tipePenilaian`;

-- AlterTable
ALTER TABLE `BankSoalParentCategory` DROP COLUMN `value`,
    ADD COLUMN `keterangan` TEXT NULL,
    ADD COLUMN `nama` VARCHAR(191) NOT NULL,
    ADD COLUMN `tipePenilaian` ENUM('BENAR_SALAH', 'POINT') NOT NULL DEFAULT 'BENAR_SALAH';

-- CreateIndex
CREATE UNIQUE INDEX `BankSoalParentCategory_nama_key` ON `BankSoalParentCategory`(`nama`);
