/*
  Warnings:

  - Added the required column `ownerUserId` to the `prompts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `prompts` ADD COLUMN `ownerUserId` VARCHAR(191) NULL;

-- Update existing rows with a default value
UPDATE `prompts` SET `ownerUserId` = (SELECT `id` FROM `User` WHERE `role` = 'admin' LIMIT 1) WHERE `ownerUserId` IS NULL;

-- Make the column required
ALTER TABLE `prompts` MODIFY `ownerUserId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `prompts_ownerUserId_idx` ON `prompts`(`ownerUserId`);

-- AddForeignKey
ALTER TABLE `prompts` ADD CONSTRAINT `prompts_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
