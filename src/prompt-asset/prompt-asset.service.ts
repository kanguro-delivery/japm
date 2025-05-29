import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreatePromptAssetDto } from './dto/create-prompt-asset.dto';
import { UpdatePromptAssetDto } from './dto/update-prompt-asset.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PromptAsset, PromptAssetVersion } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { ActivityLogService } from '../services/activityLogService';
import { ActivityAction, ActivityEntityType } from '@prisma/client';

// Type helper: Asset with its initial version
export type AssetWithInitialVersion = PromptAsset & {
  versions: PromptAssetVersion[];
};

// Type for findOne response with details
type PromptAssetWithDetails = Prisma.PromptAssetGetPayload<{
  include: {
    prompt: {
      include: {
        project: true;
        owner: true;
      };
    };
    versions: {
      orderBy: { createdAt: 'desc' };
      include: {
        translations: true;
        activeInEnvironments: { select: { id: true; name: true } };
      };
    };
  };
}>;

@Injectable()
export class PromptAssetService {
  private readonly logger = new Logger(PromptAssetService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) { }

  async create(createDto: CreatePromptAssetDto, promptId: string, projectId: string) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id: promptId },
      include: { owner: true }
    });

    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const newAsset = await tx.promptAsset.create({
          data: {
            promptId,
            projectId,
            key: createDto.key,
            enabled: true,
          },
          include: {
            prompt: {
              include: {
                owner: true
              }
            }
          }
        });

        // Crear la versión inicial del asset
        const newVersion = await tx.promptAssetVersion.create({
          data: {
            assetId: newAsset.id,
            value: createDto.initialValue,
            versionTag: '1.0.0',
            changeMessage: createDto.initialChangeMessage || 'Initial version',
            status: 'active',
          }
        });

        // Crear las traducciones iniciales si existen
        if (createDto.initialTranslations && createDto.initialTranslations.length > 0) {
          await tx.assetTranslation.createMany({
            data: createDto.initialTranslations.map(t => ({
              versionId: newVersion.id,
              languageCode: t.languageCode,
              value: t.value
            }))
          });
        }

        await this.activityLogService.logActivity({
          action: ActivityAction.CREATE,
          entityType: ActivityEntityType.PROMPT_ASSET,
          entityId: newAsset.id,
          userId: prompt.owner.id,
          projectId,
          details: `Created asset ${createDto.key} for prompt ${promptId}`,
        });

        return newAsset;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Asset with key "${createDto.key}" already exists for prompt "${promptId}" in project "${projectId}".`
          );
        }
      }
      throw error;
    }
  }

  async update(id: string, updateDto: UpdatePromptAssetDto, projectId: string) {
    const updatedAsset = await this.prisma.promptAsset.update({
      where: { id },
      data: {
        enabled: updateDto.enabled,
      },
      include: {
        prompt: {
          include: {
            owner: true
          }
        }
      }
    });

    await this.activityLogService.logActivity({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.PROMPT_ASSET,
      entityId: updatedAsset.id,
      userId: updatedAsset.prompt.owner.id,
      projectId,
      details: `Updated asset ${updatedAsset.key}`,
    });

    return updatedAsset;
  }

  async remove(id: string, projectId: string) {
    const deletedAsset = await this.prisma.promptAsset.delete({
      where: { id },
      include: {
        prompt: {
          include: {
            owner: true
          }
        }
      }
    });

    await this.activityLogService.logActivity({
      action: ActivityAction.DELETE,
      entityType: ActivityEntityType.PROMPT_ASSET,
      entityId: deletedAsset.id,
      userId: deletedAsset.prompt.owner.id,
      projectId,
      details: `Deleted asset ${deletedAsset.key}`,
    });

    return deletedAsset;
  }

  findAll(promptId: string, projectId: string): Promise<PromptAsset[]> {
    return this.prisma.promptAsset.findMany({
      where: {
        promptId,
        projectId,
      },
      include: {
        versions: {
          select: { id: true, versionTag: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: {
        key: 'asc',
      },
    });
  }

  async findOne(key: string, promptId: string, projectId: string): Promise<PromptAssetWithDetails> {
    const asset = await this.prisma.promptAsset.findUnique({
      where: {
        prompt_asset_key_unique: {
          promptId,
          projectId,
          key,
        },
      },
      include: {
        prompt: {
          include: {
            project: true,
            owner: true,
          },
        },
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            translations: true,
            activeInEnvironments: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(
        `PromptAsset with key "${key}" not found in prompt "${promptId}" (project "${projectId}")`,
      );
    }

    return asset;
  }

  async findOneByKey(
    key: string,
    promptIdInput: string,
    projectIdInput: string,
  ): Promise<PromptAssetWithDetails> {
    return this.findOne(key, promptIdInput, projectIdInput);
  }
}
