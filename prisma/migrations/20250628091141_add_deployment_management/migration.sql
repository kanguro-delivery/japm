-- AlterTable
ALTER TABLE `ActivityLog` MODIFY `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'UNPUBLISH', 'APPROVE', 'REJECT', 'DEPLOY', 'ROLLBACK') NOT NULL,
    MODIFY `entityType` ENUM('PROMPT', 'PROMPT_VERSION', 'PROMPT_TRANSLATION', 'PROMPT_ASSET', 'PROMPT_ASSET_VERSION', 'ASSET_TRANSLATION', 'PROJECT', 'ENVIRONMENT', 'AI_MODEL', 'TAG', 'REGION', 'CULTURAL_DATA', 'RAG_DOCUMENT', 'DEPLOYMENT', 'DEPLOYMENT_ITEM') NOT NULL;

-- AlterTable
ALTER TABLE `PromptExecutionLog` ADD COLUMN `deploymentId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Deployment` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'ROLLED_BACK', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `environmentId` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deployedAt` DATETIME(3) NULL,
    `rolledBackAt` DATETIME(3) NULL,
    `rollbackToDeploymentId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `Deployment_environmentId_idx`(`environmentId`),
    INDEX `Deployment_status_idx`(`status`),
    INDEX `Deployment_requestedAt_idx`(`requestedAt`),
    INDEX `Deployment_requestedById_idx`(`requestedById`),
    INDEX `Deployment_approvedById_idx`(`approvedById`),
    UNIQUE INDEX `Deployment_projectId_environmentId_name_key`(`projectId`, `environmentId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeploymentItem` (
    `id` VARCHAR(191) NOT NULL,
    `deploymentId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('PROMPT_VERSION', 'PROMPT_ASSET_VERSION', 'AI_MODEL') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `versionTag` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'ROLLED_BACK') NOT NULL DEFAULT 'PENDING',
    `deployedAt` DATETIME(3) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `changeMessage` VARCHAR(191) NULL,
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    `promptVersionId` VARCHAR(191) NULL,
    `promptAssetVersionId` VARCHAR(191) NULL,
    `aiModelId` VARCHAR(191) NULL,

    INDEX `DeploymentItem_deploymentId_idx`(`deploymentId`),
    INDEX `DeploymentItem_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `DeploymentItem_status_idx`(`status`),
    INDEX `DeploymentItem_promptVersionId_idx`(`promptVersionId`),
    INDEX `DeploymentItem_promptAssetVersionId_idx`(`promptAssetVersionId`),
    INDEX `DeploymentItem_aiModelId_idx`(`aiModelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PromptExecutionLog_deploymentId_idx` ON `PromptExecutionLog`(`deploymentId`);

-- AddForeignKey
ALTER TABLE `PromptExecutionLog` ADD CONSTRAINT `PromptExecutionLog_deploymentId_fkey` FOREIGN KEY (`deploymentId`) REFERENCES `Deployment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deployment` ADD CONSTRAINT `Deployment_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `Environment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deployment` ADD CONSTRAINT `Deployment_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deployment` ADD CONSTRAINT `Deployment_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deployment` ADD CONSTRAINT `Deployment_rollbackToDeploymentId_fkey` FOREIGN KEY (`rollbackToDeploymentId`) REFERENCES `Deployment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deployment` ADD CONSTRAINT `Deployment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentItem` ADD CONSTRAINT `DeploymentItem_deploymentId_fkey` FOREIGN KEY (`deploymentId`) REFERENCES `Deployment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentItem` ADD CONSTRAINT `DeploymentItem_promptVersionId_fkey` FOREIGN KEY (`promptVersionId`) REFERENCES `PromptVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentItem` ADD CONSTRAINT `DeploymentItem_promptAssetVersionId_fkey` FOREIGN KEY (`promptAssetVersionId`) REFERENCES `PromptAssetVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentItem` ADD CONSTRAINT `DeploymentItem_aiModelId_fkey` FOREIGN KEY (`aiModelId`) REFERENCES `AIModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
