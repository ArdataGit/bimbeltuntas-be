/*
  Warnings:

  - You are about to drop the column `tipePenilaian` on the `BankSoalParentCategory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `BankSoalCategory` ADD COLUMN `tipePenilaian` ENUM('BENAR_SALAH', 'POINT') NOT NULL DEFAULT 'BENAR_SALAH';

-- AlterTable
ALTER TABLE `BankSoalParentCategory` DROP COLUMN `tipePenilaian`;
