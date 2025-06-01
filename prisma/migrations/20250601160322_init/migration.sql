-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `role` ENUM('user', 'admin', 'tenant_admin', 'prompt_consumer') NOT NULL DEFAULT 'user',

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Region` (
    `id` VARCHAR(191) NOT NULL,
    `languageCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `parentRegion` VARCHAR(191) NULL,
    `timeZone` VARCHAR(191) NOT NULL DEFAULT '',
    `notes` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `project` VARCHAR(191) NOT NULL,

    INDEX `Region_parentRegion_idx`(`parentRegion`),
    INDEX `Region_project_idx`(`project`),
    INDEX `Region_languageCode_idx`(`languageCode`),
    UNIQUE INDEX `Region_project_languageCode_key`(`project`, `languageCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CulturalData` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `regionId` VARCHAR(191) NOT NULL,
    `style` VARCHAR(191) NOT NULL DEFAULT '',
    `notes` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `project` VARCHAR(191) NOT NULL,

    INDEX `CulturalData_regionId_idx`(`regionId`),
    INDEX `CulturalData_project_idx`(`project`),
    INDEX `CulturalData_key_idx`(`key`),
    UNIQUE INDEX `CulturalData_project_key_key`(`project`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('SYSTEM', 'USER', 'ASSISTANT', 'GUARD', 'COMPOSITE', 'CONTEXT', 'FUNCTION', 'EXAMPLE', 'TEMPLATE') NOT NULL DEFAULT 'USER',
    `projectId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `prompts_ownerUserId_idx`(`ownerUserId`),
    UNIQUE INDEX `prompts_id_projectId_key`(`id`, `projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptVersion` (
    `id` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `promptText` TEXT NOT NULL DEFAULT '',
    `languageCode` VARCHAR(191) NOT NULL DEFAULT 'en-US',
    `versionTag` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
    `changeMessage` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `aiModelId` VARCHAR(191) NULL,
    `marketplaceStatus` ENUM('NOT_PUBLISHED', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED') NOT NULL DEFAULT 'NOT_PUBLISHED',
    `marketplacePublishedAt` DATETIME(3) NULL,
    `marketplaceRequestedAt` DATETIME(3) NULL,
    `marketplaceApprovedAt` DATETIME(3) NULL,
    `marketplaceRejectionReason` VARCHAR(191) NULL,
    `marketplaceRequesterId` VARCHAR(191) NULL,
    `marketplaceApproverId` VARCHAR(191) NULL,

    INDEX `PromptVersion_prompt_idx`(`prompt`),
    INDEX `PromptVersion_aiModelId_idx`(`aiModelId`),
    INDEX `PromptVersion_marketplaceRequesterId_idx`(`marketplaceRequesterId`),
    INDEX `PromptVersion_marketplaceApproverId_idx`(`marketplaceApproverId`),
    UNIQUE INDEX `PromptVersion_prompt_versionTag_key`(`prompt`, `versionTag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptTranslation` (
    `id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `languageCode` VARCHAR(191) NOT NULL,
    `promptText` TEXT NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PromptTranslation_version_idx`(`version`),
    INDEX `PromptTranslation_languageCode_idx`(`languageCode`),
    UNIQUE INDEX `PromptTranslation_version_languageCode_key`(`version`, `languageCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptAsset` (
    `id` VARCHAR(191) NOT NULL,
    `promptId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PromptAsset_promptId_projectId_idx`(`promptId`, `projectId`),
    UNIQUE INDEX `PromptAsset_promptId_projectId_key_key`(`promptId`, `projectId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptAssetVersion` (
    `id` VARCHAR(191) NOT NULL,
    `asset` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL DEFAULT '',
    `versionTag` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
    `changeMessage` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `languageCode` VARCHAR(191) NOT NULL DEFAULT 'en-US',
    `marketplaceStatus` ENUM('NOT_PUBLISHED', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED') NOT NULL DEFAULT 'NOT_PUBLISHED',
    `marketplacePublishedAt` DATETIME(3) NULL,
    `marketplaceRequestedAt` DATETIME(3) NULL,
    `marketplaceApprovedAt` DATETIME(3) NULL,
    `marketplaceRejectionReason` VARCHAR(191) NULL,
    `marketplaceRequesterId` VARCHAR(191) NULL,
    `marketplaceApproverId` VARCHAR(191) NULL,

    INDEX `PromptAssetVersion_asset_idx`(`asset`),
    INDEX `PromptAssetVersion_marketplaceRequesterId_idx`(`marketplaceRequesterId`),
    INDEX `PromptAssetVersion_marketplaceApproverId_idx`(`marketplaceApproverId`),
    UNIQUE INDEX `PromptAssetVersion_asset_versionTag_key`(`asset`, `versionTag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetTranslation` (
    `id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `languageCode` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssetTranslation_version_idx`(`version`),
    INDEX `AssetTranslation_languageCode_idx`(`languageCode`),
    UNIQUE INDEX `AssetTranslation_version_languageCode_key`(`version`, `languageCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RagDocumentMetadata` (
    `id` VARCHAR(191) NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL DEFAULT '',
    `complianceReviewed` BOOLEAN NULL DEFAULT false,
    `piiRiskLevel` VARCHAR(191) NULL DEFAULT '',
    `lastReviewedBy` VARCHAR(191) NULL DEFAULT '',
    `regionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `project` VARCHAR(191) NOT NULL,

    INDEX `RagDocumentMetadata_project_idx`(`project`),
    INDEX `RagDocumentMetadata_regionId_idx`(`regionId`),
    UNIQUE INDEX `RagDocumentMetadata_project_documentName_key`(`project`, `documentName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `project` VARCHAR(191) NOT NULL,

    INDEX `Tag_project_idx`(`project`),
    UNIQUE INDEX `Tag_project_name_key`(`project`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NOT NULL,

    INDEX `Project_tenantId_idx`(`tenantId`),
    INDEX `Project_ownerUserId_idx`(`ownerUserId`),
    UNIQUE INDEX `Project_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIModel` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `apiIdentifier` VARCHAR(191) NULL,
    `apiKeyEnvVar` VARCHAR(191) NULL,
    `temperature` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `maxTokens` INTEGER NULL,
    `supportsJson` BOOLEAN NOT NULL DEFAULT false,
    `contextWindow` INTEGER NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `AIModel_projectId_idx`(`projectId`),
    UNIQUE INDEX `AIModel_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Environment` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `project` VARCHAR(191) NOT NULL,

    INDEX `Environment_project_idx`(`project`),
    UNIQUE INDEX `Environment_project_name_key`(`project`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptExecutionLog` (
    `id` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `promptVersionId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `input` VARCHAR(191) NOT NULL,
    `output` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `durationMs` INTEGER NULL,
    `errorMessage` VARCHAR(191) NULL,
    `project` VARCHAR(191) NOT NULL,

    INDEX `PromptExecutionLog_promptVersionId_idx`(`promptVersionId`),
    INDEX `PromptExecutionLog_environmentId_idx`(`environmentId`),
    INDEX `PromptExecutionLog_userId_idx`(`userId`),
    INDEX `PromptExecutionLog_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemPrompt` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `promptText` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemPrompt_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `marketplaceRequiresApproval` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'UNPUBLISH', 'APPROVE', 'REJECT') NOT NULL,
    `entityType` ENUM('PROMPT', 'PROMPT_VERSION', 'PROMPT_TRANSLATION', 'PROMPT_ASSET', 'PROMPT_ASSET_VERSION', 'ASSET_TRANSLATION', 'PROJECT', 'ENVIRONMENT', 'AI_MODEL', 'TAG', 'REGION', 'CULTURAL_DATA', 'RAG_DOCUMENT') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `details` TEXT NULL,
    `changes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ActivityLog_timestamp_idx`(`timestamp`),
    INDEX `ActivityLog_entityType_idx`(`entityType`),
    INDEX `ActivityLog_entityId_idx`(`entityId`),
    INDEX `ActivityLog_userId_idx`(`userId`),
    INDEX `ActivityLog_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_PromptTags` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_PromptTags_AB_unique`(`A`, `B`),
    INDEX `_PromptTags_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ActivePromptsInEnvironment` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_ActivePromptsInEnvironment_AB_unique`(`A`, `B`),
    INDEX `_ActivePromptsInEnvironment_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ActiveAssetsInEnvironment` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_ActiveAssetsInEnvironment_AB_unique`(`A`, `B`),
    INDEX `_ActiveAssetsInEnvironment_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Region` ADD CONSTRAINT `Region_parentRegion_fkey` FOREIGN KEY (`parentRegion`) REFERENCES `Region`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Region` ADD CONSTRAINT `Region_project_fkey` FOREIGN KEY (`project`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalData` ADD CONSTRAINT `CulturalData_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalData` ADD CONSTRAINT `CulturalData_project_fkey` FOREIGN KEY (`project`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompts` ADD CONSTRAINT `prompts_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompts` ADD CONSTRAINT `prompts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompts` ADD CONSTRAINT `prompts_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptVersion` ADD CONSTRAINT `PromptVersion_prompt_fkey` FOREIGN KEY (`prompt`) REFERENCES `prompts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptVersion` ADD CONSTRAINT `PromptVersion_aiModelId_fkey` FOREIGN KEY (`aiModelId`) REFERENCES `AIModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptVersion` ADD CONSTRAINT `PromptVersion_marketplaceRequesterId_fkey` FOREIGN KEY (`marketplaceRequesterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptVersion` ADD CONSTRAINT `PromptVersion_marketplaceApproverId_fkey` FOREIGN KEY (`marketplaceApproverId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptTranslation` ADD CONSTRAINT `PromptTranslation_version_fkey` FOREIGN KEY (`version`) REFERENCES `PromptVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptAsset` ADD CONSTRAINT `PromptAsset_promptId_projectId_fkey` FOREIGN KEY (`promptId`, `projectId`) REFERENCES `prompts`(`id`, `projectId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptAssetVersion` ADD CONSTRAINT `PromptAssetVersion_asset_fkey` FOREIGN KEY (`asset`) REFERENCES `PromptAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptAssetVersion` ADD CONSTRAINT `PromptAssetVersion_marketplaceRequesterId_fkey` FOREIGN KEY (`marketplaceRequesterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptAssetVersion` ADD CONSTRAINT `PromptAssetVersion_marketplaceApproverId_fkey` FOREIGN KEY (`marketplaceApproverId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetTranslation` ADD CONSTRAINT `AssetTranslation_version_fkey` FOREIGN KEY (`version`) REFERENCES `PromptAssetVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RagDocumentMetadata` ADD CONSTRAINT `RagDocumentMetadata_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RagDocumentMetadata` ADD CONSTRAINT `RagDocumentMetadata_project_fkey` FOREIGN KEY (`project`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tag` ADD CONSTRAINT `Tag_project_fkey` FOREIGN KEY (`project`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIModel` ADD CONSTRAINT `AIModel_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Environment` ADD CONSTRAINT `Environment_project_fkey` FOREIGN KEY (`project`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptExecutionLog` ADD CONSTRAINT `PromptExecutionLog_promptVersionId_fkey` FOREIGN KEY (`promptVersionId`) REFERENCES `PromptVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptExecutionLog` ADD CONSTRAINT `PromptExecutionLog_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `Environment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptExecutionLog` ADD CONSTRAINT `PromptExecutionLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptExecutionLog` ADD CONSTRAINT `PromptExecutionLog_project_fkey` FOREIGN KEY (`project`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PromptTags` ADD CONSTRAINT `_PromptTags_A_fkey` FOREIGN KEY (`A`) REFERENCES `prompts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PromptTags` ADD CONSTRAINT `_PromptTags_B_fkey` FOREIGN KEY (`B`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ActivePromptsInEnvironment` ADD CONSTRAINT `_ActivePromptsInEnvironment_A_fkey` FOREIGN KEY (`A`) REFERENCES `Environment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ActivePromptsInEnvironment` ADD CONSTRAINT `_ActivePromptsInEnvironment_B_fkey` FOREIGN KEY (`B`) REFERENCES `PromptVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ActiveAssetsInEnvironment` ADD CONSTRAINT `_ActiveAssetsInEnvironment_A_fkey` FOREIGN KEY (`A`) REFERENCES `Environment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ActiveAssetsInEnvironment` ADD CONSTRAINT `_ActiveAssetsInEnvironment_B_fkey` FOREIGN KEY (`B`) REFERENCES `PromptAssetVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
