import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CreatePromptAssetVersionDto } from './dto/create-prompt-asset-version.dto';
import { UpdatePromptAssetVersionDto } from './dto/update-prompt-asset-version.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  PromptAssetVersion,
  PromptAsset,
  MarketplacePublishStatus,
  Prompt,
  ActivityAction,
  ActivityEntityType,
} from '@prisma/client';
import { TenantService } from '../tenant/tenant.service';
import { Logger } from '@nestjs/common';
import { ActivityLogService } from '../services/activityLogService';
import { AuditLoggerService } from '../common/services/audit-logger.service';

@Injectable()
export class PromptAssetVersionService {
  private readonly logger = new Logger(PromptAssetVersionService.name);

  constructor(
    private prisma: PrismaService,
    private tenantService: TenantService,
    private activityLogService: ActivityLogService,
    private auditLogger: AuditLoggerService,
  ) { }

  private async getParentAsset(
    projectId: string,
    promptId: string,
    assetKey: string,
  ): Promise<PromptAsset & { prompt: Prompt }> {
    const asset = await this.prisma.promptAsset.findUnique({
      where: {
        prompt_asset_key_unique: { projectId, promptId, key: assetKey },
      },
      include: {
        prompt: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(
        `PromptAsset with key "${assetKey}" for prompt "${promptId}" not found in project "${projectId}".`,
      );
    }

    if (asset.prompt.projectId !== projectId) {
      throw new ForbiddenException(
        'Mismatch between asset project and provided project ID.',
      );
    }

    return asset;
  }

  async create(
    projectId: string,
    promptId: string,
    assetKey: string,
    createDto: CreatePromptAssetVersionDto,
  ): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const parentAsset = await this.getParentAsset(
      projectId,
      promptId,
      assetKey,
    );

    const { versionTag, ...versionData } = createDto;

    try {
      const newVersion = await this.prisma.promptAssetVersion.create({
        data: {
          ...versionData,
          versionTag: versionTag,
          asset: { connect: { id: parentAsset.id } },
          translations: createDto.translations ? {
            createMany: {
              data: createDto.translations.map(t => ({
                languageCode: t.languageCode,
                value: t.value
              }))
            }
          } : undefined
        },
        include: {
          asset: {
            include: {
              prompt: true,
            },
          },
          translations: true
        },
      });

      await this.activityLogService.logActivity({
        action: 'CREATE',
        entityType: 'PROMPT_ASSET_VERSION',
        entityId: newVersion.id,
        userId: parentAsset.prompt.ownerUserId,
        projectId: projectId,
        details: {
          assetKey,
          promptId,
          versionTag: newVersion.versionTag,
          languageCode: newVersion.languageCode,
        },
      });

      return newVersion;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Version tag "${versionTag}" already exists for asset "${assetKey}" (ID: ${parentAsset.id}).`,
        );
      }
      this.logger.error(
        `Error creating version "${versionTag}" for asset "${assetKey}" (ID: ${parentAsset.id}):`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async findAllForAsset(
    projectId: string,
    promptId: string,
    assetKey: string,
    languageCode?: string,
  ): Promise<PromptAssetVersion[]> {
    const parentAsset = await this.getParentAsset(
      projectId,
      promptId,
      assetKey,
    );
    return this.prisma.promptAssetVersion.findMany({
      where: {
        assetId: parentAsset.id,
        ...(languageCode ? { languageCode } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { translations: true },
    });
  }

  async findOneByTag(
    projectId: string,
    promptId: string,
    assetKey: string,
    versionTag: string,
    languageCode?: string,
  ): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const parentAsset = await this.getParentAsset(
      projectId,
      promptId,
      assetKey,
    );
    let version: (PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }) | null = null;
    if (languageCode) {
      version = await this.prisma.promptAssetVersion.findFirst({
        where: {
          assetId: parentAsset.id,
          versionTag,
          translations: {
            some: {
              languageCode,
            },
          },
        },
        include: {
          asset: {
            include: {
              prompt: true,
            },
          },
          translations: true,
        },
      });
    } else {
      version = await this.prisma.promptAssetVersion.findUnique({
        where: {
          assetId_versionTag: {
            assetId: parentAsset.id,
            versionTag: versionTag,
          },
        },
        include: {
          asset: {
            include: {
              prompt: true,
            },
          },
          translations: true,
        },
      });
    }
    if (!version) {
      throw new NotFoundException(
        `PromptAssetVersion with tag "${versionTag}"${languageCode ? ` and languageCode "${languageCode}"` : ''} not found for asset "${assetKey}" (ID: ${parentAsset.id}).`,
      );
    }
    return version;
  }

  async update(
    id: string,
    projectId: string,
    userId: string,
    data: Prisma.PromptAssetVersionUpdateInput,
  ): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const existingVersion = await this.findOne(id);

    const updatedVersion = await this.prisma.promptAssetVersion.update({
      where: { id },
      data,
      include: {
        asset: {
          include: {
            prompt: true,
          },
        },
      },
    });

    await this.activityLogService.logActivity({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.PROMPT_ASSET_VERSION,
      entityId: id,
      userId,
      projectId,
      details: {
        versionTag: updatedVersion.versionTag,
        assetKey: updatedVersion.asset.key,
      },
    });

    return updatedVersion;
  }

  async remove(
    projectId: string,
    promptId: string,
    assetKey: string,
    versionTag: string,
  ): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const existingVersion = await this.findOneByTag(
      projectId,
      promptId,
      assetKey,
      versionTag,
    );

    try {
      const deletedVersion = await this.prisma.promptAssetVersion.delete({
        where: {
          id: existingVersion.id,
        },
        include: {
          asset: {
            include: {
              prompt: true,
            },
          },
        },
      });

      await this.activityLogService.logActivity({
        action: 'DELETE',
        entityType: 'PROMPT_ASSET_VERSION',
        entityId: deletedVersion.id,
        userId: deletedVersion.asset.prompt.ownerUserId,
        projectId: projectId,
        details: {
          assetKey,
          promptId,
          versionTag: deletedVersion.versionTag,
          languageCode: deletedVersion.languageCode,
        },
      });

      return deletedVersion;
    } catch (error) {
      this.logger.error(
        `Error deleting version "${versionTag}" for asset "${assetKey}" (ID: ${existingVersion.id}):`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async findOne(id: string): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const version = await this.prisma.promptAssetVersion.findUnique({
      where: { id },
      include: {
        asset: {
          include: {
            prompt: true,
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException(`Version with ID ${id} not found`);
    }

    return version;
  }

  async requestPublish(
    id: string,
    projectId: string,
    userId: string,
    tenantId: string,
  ): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const existingVersion = await this.findOne(id);

    if (existingVersion.marketplaceStatus === MarketplacePublishStatus.PUBLISHED) {
      throw new ConflictException('This version is already published');
    }

    if (existingVersion.marketplaceStatus === MarketplacePublishStatus.PENDING_APPROVAL) {
      throw new ConflictException('This version is already pending approval');
    }

    const updatedVersion = await this.prisma.promptAssetVersion.update({
      where: { id },
      data: {
        marketplaceStatus: MarketplacePublishStatus.PENDING_APPROVAL,
        marketplaceRequestedAt: new Date(),
        marketplaceRequesterId: userId,
      },
      include: {
        asset: {
          include: {
            prompt: true,
          },
        },
      },
    });

    await this.activityLogService.logActivity({
      action: ActivityAction.PUBLISH,
      entityType: ActivityEntityType.PROMPT_ASSET_VERSION,
      entityId: id,
      userId,
      projectId,
      details: {
        versionTag: updatedVersion.versionTag,
        assetKey: updatedVersion.asset.key,
      },
    });

    return updatedVersion;
  }

  async unpublish(
    projectId: string,
    promptId: string,
    assetKey: string,
    versionTag: string,
  ): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const existingVersion = await this.findOneByTag(
      projectId,
      promptId,
      assetKey,
      versionTag,
    );

    if (existingVersion.marketplaceStatus !== MarketplacePublishStatus.PUBLISHED) {
      throw new ConflictException(
        `Version "${versionTag}" is not published.`,
      );
    }

    try {
      const updatedVersion = await this.prisma.promptAssetVersion.update({
        where: {
          id: existingVersion.id,
        },
        data: {
          marketplaceStatus: MarketplacePublishStatus.NOT_PUBLISHED,
          marketplacePublishedAt: null,
        },
        include: {
          asset: {
            include: {
              prompt: true,
            },
          },
        },
      });

      await this.activityLogService.logActivity({
        action: ActivityAction.UNPUBLISH,
        entityType: ActivityEntityType.PROMPT_ASSET_VERSION,
        entityId: updatedVersion.id,
        userId: existingVersion.asset.prompt.ownerUserId,
        projectId: projectId,
        details: {
          assetKey,
          promptId,
          versionTag: updatedVersion.versionTag,
          languageCode: updatedVersion.languageCode,
        },
      });

      return updatedVersion;
    } catch (error) {
      this.logger.error(
        `Error unpublishing version "${versionTag}" of asset "${assetKey}" (ID: ${existingVersion.id}):`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async approvePublish(
    projectId: string,
    promptId: string,
    assetKey: string,
    versionTag: string,
    approverId: string,
  ): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const existingVersion = await this.findOneByTag(
      projectId,
      promptId,
      assetKey,
      versionTag,
    );

    if (existingVersion.marketplaceStatus !== MarketplacePublishStatus.PENDING_APPROVAL) {
      throw new ConflictException(
        `Version "${versionTag}" is not pending approval.`,
      );
    }

    try {
      const updatedVersion = await this.prisma.promptAssetVersion.update({
        where: {
          id: existingVersion.id,
        },
        data: {
          marketplaceStatus: MarketplacePublishStatus.PUBLISHED,
          marketplaceApprovedAt: new Date(),
          marketplaceApproverId: approverId,
        },
        include: {
          asset: {
            include: {
              prompt: true,
            },
          },
        },
      });

      await this.activityLogService.logActivity({
        action: ActivityAction.APPROVE,
        entityType: ActivityEntityType.PROMPT_ASSET_VERSION,
        entityId: updatedVersion.id,
        userId: approverId,
        projectId: projectId,
        details: {
          assetKey,
          promptId,
          versionTag: updatedVersion.versionTag,
          languageCode: updatedVersion.languageCode,
        },
      });

      return updatedVersion;
    } catch (error) {
      this.logger.error(
        `Error approving publish for version "${versionTag}" of asset "${assetKey}" (ID: ${existingVersion.id}):`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async rejectPublish(
    projectId: string,
    promptId: string,
    assetKey: string,
    versionTag: string,
    approverId: string,
    rejectionReason: string,
  ): Promise<PromptAssetVersion & { asset: PromptAsset & { prompt: Prompt } }> {
    const existingVersion = await this.findOneByTag(
      projectId,
      promptId,
      assetKey,
      versionTag,
    );

    if (existingVersion.marketplaceStatus !== MarketplacePublishStatus.PENDING_APPROVAL) {
      throw new ConflictException(
        `Version "${versionTag}" is not pending approval.`,
      );
    }

    try {
      const updatedVersion = await this.prisma.promptAssetVersion.update({
        where: {
          id: existingVersion.id,
        },
        data: {
          marketplaceStatus: MarketplacePublishStatus.REJECTED,
          marketplaceApprovedAt: null,
          marketplaceApproverId: approverId,
          marketplaceRejectionReason: rejectionReason,
        },
        include: {
          asset: {
            include: {
              prompt: true,
            },
          },
        },
      });

      await this.activityLogService.logActivity({
        action: ActivityAction.REJECT,
        entityType: ActivityEntityType.PROMPT_ASSET_VERSION,
        entityId: updatedVersion.id,
        userId: approverId,
        projectId: projectId,
        details: {
          assetKey,
          promptId,
          versionTag: updatedVersion.versionTag,
          languageCode: updatedVersion.languageCode,
          rejectionReason,
        },
      });

      return updatedVersion;
    } catch (error) {
      this.logger.error(
        `Error rejecting publish for version "${versionTag}" of asset "${assetKey}" (ID: ${existingVersion.id}):`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
