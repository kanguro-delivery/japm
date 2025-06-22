import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreatePromptTranslationDto } from './dto/create-prompt-translation.dto';
import { UpdatePromptTranslationDto } from './dto/update-prompt-translation.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PromptTranslation } from '@prisma/client';
import { CreateOrUpdatePromptTranslationDto } from './dto/create-or-update-prompt-translation.dto';
import { ServePromptService } from '../serve-prompt/serve-prompt.service';
import { ResolveAssetsQueryDto } from '../serve-prompt/dto/resolve-assets-query.dto';
import { PromptVersionService } from '../prompt-version/prompt-version.service';

@Injectable()
export class PromptTranslationService {
  private readonly logger = new Logger(PromptTranslationService.name);

  constructor(
    private prisma: PrismaService,
    private servePromptService: ServePromptService,
    private promptVersionService: PromptVersionService,
  ) { }

  async create(
    projectId: string,
    promptId: string,
    versionTag: string,
    createDto: CreatePromptTranslationDto,
  ): Promise<PromptTranslation> {
    const version = await this.promptVersionService.getByTagOrLatest(
      projectId,
      promptId,
      versionTag,
    );
    const { languageCode, promptText } = createDto;

    try {
      return await this.prisma.promptTranslation.create({
        data: {
          promptText,
          languageCode,
          version: { connect: { id: version.id } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Translation for language "${languageCode}" already exists for version "${versionTag}" of prompt "${promptId}".`,
        );
      }
      throw error;
    }
  }

  async findAllForVersion(
    projectId: string,
    promptId: string,
    versionTag: string,
  ): Promise<PromptTranslation[]> {
    const version = await this.promptVersionService.getByTagOrLatest(
      projectId,
      promptId,
      versionTag,
    );
    return this.prisma.promptTranslation.findMany({
      where: { versionId: version.id },
    });
  }

  async findOneByLanguage(
    projectId: string,
    promptId: string,
    versionTag: string,
    languageCode: string,
    query?: ResolveAssetsQueryDto,
  ): Promise<PromptTranslation> {
    this.logger.debug(
      `Finding translation for prompt ${promptId}, version ${versionTag}, language ${languageCode} with query params: ${JSON.stringify(query)}`,
    );

    const version = await this.promptVersionService.getByTagOrLatest(
      projectId,
      promptId,
      versionTag,
    );

    const translation = await this.prisma.promptTranslation.findUnique({
      where: {
        versionId_languageCode: {
          versionId: version.id,
          languageCode: languageCode,
        },
      },
    });

    if (!translation) {
      throw new NotFoundException(
        `Translation not found for prompt ${promptId}, version ${versionTag}, language ${languageCode}`,
      );
    }

    if (query?.processed) {
      this.logger.debug(
        'Processing translation with all references and variables',
      );
      try {
        const variables = query.variables ? JSON.parse(query.variables) : {};
        const result = await this.servePromptService.executePromptVersion(
          {
            projectId,
            promptName: promptId,
            versionTag,
            languageCode: query.regionCode || languageCode,
          },
          {
            variables,
          },
          {},
          new Set(),
          {
            currentDepth: 0,
            maxDepth: 5,
          },
        );

        if (result.metadata?.unresolvedPromptPlaceholders?.length > 0) {
          this.logger.warn(
            `Found unresolved prompt placeholders: ${result.metadata.unresolvedPromptPlaceholders.join(
              ', ',
            )}`,
          );
        }

        translation.promptText = result.processedPrompt;
        (translation as any).metadata = {
          processed: true,
          unresolvedPromptPlaceholders:
            result.metadata?.unresolvedPromptPlaceholders || [],
          assets: result.assets,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Error processing translation: ${message}`,
          stack,
        );
        throw new InternalServerErrorException(
          `Error processing translation: ${message}`,
        );
      }
    } else if (query?.resolveAssets) {
      this.logger.debug('Resolving assets in translation');
      const regionCode = query.regionCode || languageCode;
      const environmentId = query.environmentId || '';
      const result = await this.servePromptService.resolveAssets(
        translation.promptText,
        projectId,
        environmentId,
        regionCode,
      );

      if (result.resolvedAssetsMetadata?.length > 0) {
        this.logger.debug(
          `Resolved ${result.resolvedAssetsMetadata.length} assets`,
        );
      }

      translation.promptText = result.processedText;
      (translation as any).metadata = {
        resolvedAssets: result.resolvedAssetsMetadata || [],
      };
    }

    return translation;
  }

  async update(
    projectId: string,
    promptId: string,
    versionTag: string,
    languageCode: string,
    updateDto: UpdatePromptTranslationDto,
  ): Promise<PromptTranslation> {
    const existingTranslation = await this.findOneByLanguage(
      projectId,
      promptId,
      versionTag,
      languageCode,
      undefined,
    );

    try {
      return await this.prisma.promptTranslation.update({
        where: {
          id: existingTranslation.id,
        },
        data: updateDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Translation not found for update.`);
      }
      throw error;
    }
  }

  async remove(
    projectId: string,
    promptId: string,
    versionTag: string,
    languageCode: string,
  ): Promise<PromptTranslation> {
    this.logger.log(
      `Attempting to delete translation "${languageCode}" for version "${versionTag}" of prompt "${promptId}" in project "${projectId}"`,
    );

    let existingTranslation: PromptTranslation;
    try {
      existingTranslation = await this.findOneByLanguage(
        projectId,
        promptId,
        versionTag,
        languageCode,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        // Translation already doesn't exist - this is idempotent behavior
        this.logger.log(
          `Translation "${languageCode}" not found for version "${versionTag}" of prompt "${promptId}" - already deleted or never existed`,
        );

        // Return a mock translation object to maintain API compatibility
        const mockTranslation: PromptTranslation = {
          id: `deleted-${languageCode}-${versionTag}-${Date.now()}`,
          versionId: `unknown-version-${Date.now()}`,
          languageCode,
          promptText: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return mockTranslation; // Return successfully (idempotent)
      }

      this.logger.error(
        `Error finding translation "${languageCode}" for deletion: ${error.message}`,
        error.stack,
      );
      throw error;
    }

    try {
      const deletedTranslation = await this.prisma.promptTranslation.delete({
        where: {
          id: existingTranslation.id,
        },
      });

      this.logger.log(
        `Successfully deleted translation "${languageCode}" (ID: ${existingTranslation.id}) for version "${versionTag}" of prompt "${promptId}"`,
      );
      return deletedTranslation;
    } catch (error) {
      // Handle specific Prisma errors for idempotent behavior
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Translation was deleted by another process between findOneByLanguage and delete
        this.logger.log(
          `Translation "${languageCode}" was already deleted by another process during deletion attempt`,
        );

        // Return the existing translation data (successful idempotent operation)
        return existingTranslation;
      }

      this.logger.error(
        `Failed to delete translation "${languageCode}" for version "${versionTag}" of prompt "${promptId}": ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async upsertTranslation(
    versionId: string,
    dto: CreateOrUpdatePromptTranslationDto,
  ): Promise<PromptTranslation> {
    const { languageCode, promptText } = dto;

    // 1. Verificar que la versión del prompt exista
    const versionExists = await this.prisma.promptVersion.findUnique({
      where: { id: versionId },
      select: { id: true },
    });

    if (!versionExists) {
      throw new NotFoundException(
        `PromptVersion with ID "${versionId}" not found.`,
      );
    }

    // 2. Crear o actualizar la traducción
    try {
      return await this.prisma.promptTranslation.upsert({
        where: {
          versionId_languageCode: { versionId, languageCode },
        },
        update: { promptText },
        create: { versionId, languageCode, promptText },
      });
    } catch (error) {
      console.error(
        `Failed to upsert prompt translation for version ${versionId} and language ${languageCode}:`,
        error,
      );
      throw new Error('Could not save prompt translation.');
    }
  }

  async findByVersion(versionId: string): Promise<PromptTranslation[]> {
    return this.prisma.promptTranslation.findMany({
      where: { versionId },
    });
  }

  async removeTranslation(
    versionId: string,
    languageCode: string,
  ): Promise<PromptTranslation> {
    try {
      return await this.prisma.promptTranslation.delete({
        where: {
          versionId_languageCode: { versionId, languageCode },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Prompt Translation for language "${languageCode}" in version "${versionId}" not found.`,
        );
      }
      throw error;
    }
  }
}
