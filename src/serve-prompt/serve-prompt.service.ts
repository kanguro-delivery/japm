import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  Prompt,
  PromptVersion,
  PromptTranslation,
  Environment,
  CulturalData,
} from '@prisma/client';
// import { TemplateService } from '../template/template.service'; // Temporarily commented out
import { ExecutePromptParamsDto } from './dto/execute-prompt-params.dto';
import { ExecutePromptQueryDto } from './dto/execute-prompt-query.dto';
import { ExecutePromptBodyDto } from './dto/execute-prompt-body.dto';

// Definición de la función slugify (copiada de prompt.service.ts)
function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFKD') // Normalize to decompose combined graphemes
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars (keeps hyphen)
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

@Injectable()
export class ServePromptService {
  private readonly logger = new Logger(ServePromptService.name);

  constructor(
    private prisma: PrismaService,
    // private templateService: TemplateService // Temporarily commented out
  ) { }

  /**
   * Resolves asset placeholders in a given text.
   * @param text The text containing potential asset placeholders.
   * @param promptIdInput The ID of the prompt to scope asset search.
   * @param projectIdInput The ID of the project to scope asset search.
   * @param languageCode Optional language code for asset translation.
   * @param inputVariables Optional map of variables to distinguish from assets.
   * @param promptContext Optional prompt context for better logging
   * @returns An object containing the processed text and metadata about resolved assets.
   */
  async resolveAssets(
    text: string,
    promptIdInput: string,
    projectIdInput: string,
    languageCode?: string,
    inputVariables: Record<string, any> = {},
  ): Promise<{ processedText: string; resolvedAssetsMetadata: any[] }> {
    // Removed detailed debug logs from here for brevity in production

    let processedText = text;
    const assetContext: Record<string, string> = {};
    const resolvedAssetsMetadata: any[] = [];

    const allAssetMatches = [...text.matchAll(/\{\{asset:([^}]+)\}\}/g)];

    const assetSpecifications = allAssetMatches
      .filter((match) => {
        const placeholderContent = match[1].trim();
        const [key] = placeholderContent.split(':');
        return !inputVariables.hasOwnProperty(key);
      })
      .map((match) => {
        const placeholderContent = match[1].trim();
        const [key, versionTag] = placeholderContent.split(':');
        return { key, versionTag, placeholderContent };
      });

    if (assetSpecifications.length > 0) {
      const uniqueAssetKeys = [
        ...new Set(assetSpecifications.map((spec) => spec.key)),
      ];
      const foundAssets = await this.prisma.promptAsset.findMany({
        where: {
          promptId: promptIdInput,
          projectId: projectIdInput,
          key: { in: uniqueAssetKeys },
        },
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
            include: { translations: true },
          },
        },
      });

      for (const spec of assetSpecifications) {
        const asset = foundAssets.find((a) => a.key === spec.key);
        if (!asset) {
          this.logger.warn(
            `Asset with key "${spec.key}" (referenced as "{{${spec.placeholderContent}}}") not found for prompt "${promptIdInput}" in project "${projectIdInput}".`,
          );
          continue;
        }
        const assetVersions = asset.versions;
        if (!assetVersions || assetVersions.length === 0) {
          this.logger.warn(
            `Asset key "${spec.key}" for prompt "${promptIdInput}" found, but no versions available.`,
          );
          continue;
        }
        let targetVersion: (typeof assetVersions)[0] | undefined = undefined;
        if (spec.versionTag) {
          targetVersion = assetVersions.find((v) => v.versionTag === spec.versionTag);
          if (!targetVersion) {
            this.logger.warn(
              `Asset key "${spec.key}", version "${spec.versionTag}" not found. Falling back to latest active version.`,
            );
          }
        }
        if (!targetVersion) {
          targetVersion = assetVersions.find((v) => v.status === 'active') || assetVersions[0];
        }
        if (targetVersion) {
          let assetValue = targetVersion.value;
          let languageSource = 'base_asset';
          if (languageCode) {
            const translation = targetVersion.translations.find((t) => t.languageCode === languageCode);
            if (translation) {
              assetValue = translation.value;
              languageSource = languageCode;
            } else {
              this.logger.warn(
                `Asset key "${spec.key}" v${targetVersion.versionTag}: No translation found for "${languageCode}". Using base value.`,
              );
              languageSource = 'base_asset_fallback';
            }
          }
          assetContext[spec.placeholderContent] = assetValue;
          resolvedAssetsMetadata.push({
            key: asset.key,
            placeholderUsed: spec.placeholderContent,
            versionId: targetVersion.id,
            versionTag: targetVersion.versionTag,
            languageUsed: languageSource,
          });
        } else {
          this.logger.warn(
            `Asset key "${spec.key}" for prompt "${promptIdInput}" found, but no suitable version (specified: ${spec.versionTag || 'any active'}) could be resolved.`,
          );
        }
      }
    }

    const variableContext: Record<string, string> = {};
    const variablePlaceholders = [...text.matchAll(/\{\{variable:([^}]+)\}\}/g)];
    for (const match of variablePlaceholders) {
      const placeholder = match[0];
      const variableName = match[1].trim();
      if (inputVariables.hasOwnProperty(variableName)) {
        variableContext[variableName] = String(inputVariables[variableName]);
      } else {
        this.logger.warn(
          `Variable "${variableName}" (referenced as "${placeholder}") not provided. Available: ${Object.keys(inputVariables).join(', ') || 'none'}`,
        );
      }
    }

    for (const [placeholderContent, assetValue] of Object.entries(assetContext)) {
      const placeholder = `{{asset:${placeholderContent}}}`;
      processedText = processedText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), assetValue);
    }
    for (const [variableName, variableValue] of Object.entries(variableContext)) {
      const placeholder = `{{variable:${variableName}}}`;
      processedText = processedText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), variableValue);
    }
    return { processedText, resolvedAssetsMetadata };
  }

  /**
   * Resolves prompt references in a given text.
   * @param text The text containing potential prompt references.
   * @param currentProcessingProjectId The ID of the project to scope prompt search.
   * @param body The body containing variables for the prompt.
   * @param languageCode Optional language code for prompt translation.
   * @param processedPrompts Set of already processed prompts to prevent circular references.
   * @param context Additional context for prompt resolution
   * @returns An object containing the processed text and metadata about resolved prompts.
   */
  private async resolvePromptReferences(
    text: string,
    currentProcessingProjectId: string,
    body: ExecutePromptBodyDto,
    languageCode?: string,
    processedPrompts: Set<string> = new Set(),
    context: {
      currentPromptType?: string;
      maxDepth?: number;
      currentDepth?: number;
    } = {},
  ): Promise<{ processedText: string; resolvedPromptsMetadata: any[] }> {
    const { currentDepth = 0, maxDepth = 5 } = context;
    let currentText = text;
    const resolvedPromptsMetadata: any[] = [];
    const promptRefRegex = /\{\{prompt:(([^:}]+?)\/)?([^:}]+?)(?::([^}]+))?\}\}/g;
    let match;

    while ((match = promptRefRegex.exec(currentText)) !== null) {
      const fullMatch = match[0];
      const specifiedProjectId = match[2];
      const referencedPromptIdentifier = match[3];
      const referencedVersionTag = match[4];
      const projectIdForNestedPrompt = specifiedProjectId || currentProcessingProjectId;

      // Minimal debug log for reference found
      this.logger.debug(`Found prompt reference: ${fullMatch}`);

      const uniqueRefKey = `${projectIdForNestedPrompt}/${referencedPromptIdentifier}`;
      if (processedPrompts.has(uniqueRefKey)) {
        const errorMessage = `Circular reference detected for prompt: "${referencedPromptIdentifier}" in project "${projectIdForNestedPrompt}". Path: ${Array.from(processedPrompts).join(' -> ')} -> ${uniqueRefKey}`;
        this.logger.error(`[RESOLVE PROMPT REF] ${errorMessage}`);
        throw new BadRequestException(errorMessage);
      }
      processedPrompts.add(uniqueRefKey);

      try {
        // Minimal debug log for recursive call
        this.logger.debug(`Calling executePromptVersion for nested: ${uniqueRefKey}`);
        const nestedResult = await this.executePromptVersion(
          {
            projectId: projectIdForNestedPrompt,
            promptName: referencedPromptIdentifier,
            versionTag: referencedVersionTag || 'latest',
            languageCode: languageCode,
          },
          body,
          new Set(processedPrompts),
          {
            currentDepth: currentDepth + 1,
            maxDepth,
          },
        );
        currentText = currentText.replace(fullMatch, nestedResult.processedPrompt);
        if (nestedResult.metadata?.resolvedPrompts) {
          resolvedPromptsMetadata.push(...nestedResult.metadata.resolvedPrompts);
        }
        resolvedPromptsMetadata.push({
          identifier: referencedPromptIdentifier,
          projectId: projectIdForNestedPrompt,
          versionTag: referencedVersionTag || 'latest',
          status: 'resolved',
          sourceTextLength: nestedResult.processedPrompt.length,
        });
      } catch (error) {
        if (error instanceof HttpException) {
          this.logger.warn(
            `HttpException during recursive call for "${uniqueRefKey}": ${error.message}. Propagating error.`,
          );
          throw error;
        }
        this.logger.error(
          `Unexpected error during recursive call for "${uniqueRefKey}": ${error.message}`,
          error.stack,
        );
        resolvedPromptsMetadata.push({
          type: 'error',
          message: `Failed to resolve nested prompt: ${referencedPromptIdentifier}. Error: ${error.message}`,
          promptIdentifier: referencedPromptIdentifier,
          projectId: projectIdForNestedPrompt,
        });
      }
    }
    return { processedText: currentText, resolvedPromptsMetadata };
  }

  /**
   * Executes a specific prompt version with given variables.
   * Handles translation, asset substitution, and prompt references.
   * @returns The processed prompt text ready for execution.
   */
  async executePromptVersion(
    params: ExecutePromptParamsDto,
    body: ExecutePromptBodyDto,
    processedPrompts: Set<string> = new Set(),
    context: {
      currentDepth?: number;
      maxDepth?: number;
    } = {},
  ): Promise<{ processedPrompt: string; metadata: any }> {
    const { projectId, promptName, versionTag, languageCode } = params;
    const { variables } = body;
    const { currentDepth = 0, maxDepth = 5 } = context;

    this.logger.debug(
      `Executing prompt "${promptName}" v${versionTag} (project: ${projectId}, depth: ${currentDepth})`,
    );

    if (currentDepth >= maxDepth) {
      this.logger.warn(
        `Maximum depth (${maxDepth}) reached for prompt "${promptName}".`,
      );
      throw new BadRequestException(
        `Maximum prompt reference depth (${maxDepth}) reached. Possible circular reference involving "${promptName}".`,
      );
    }

    const promptNameSlug = slugify(promptName);
    const currentProjectId = projectId;
    let promptToExecute: Partial<Prompt> & { versions?: any[] } | null = null;
    const isCuidLike = promptName && promptName.length === 25 && promptName.startsWith('c');

    if (isCuidLike) {
      promptToExecute = await this.prisma.prompt.findUnique({
        where: {
          prompt_id_project_unique: {
            id: promptName,
            projectId: currentProjectId,
          },
        },
        select: { id: true, name: true, type: true, projectId: true, tenantId: true },
      });
    }
    if (!promptToExecute) {
      if (isCuidLike) {
        this.logger.debug(
          `🚀 [EXECUTE PROMPT] CUID-like input "${promptName}" not found by CUID lookup. Proceeding to other lookup methods.`
        );
      }
      this.logger.debug(
        `🚀 [EXECUTE PROMPT] Input "${promptName}" not CUID-like or not found by CUID. Attempting direct ID lookup in project "${currentProjectId}".`
      );
      // Attempt 1: Treat promptName as a potential pre-existing ID
      promptToExecute = await this.prisma.prompt.findUnique({
        where: {
          prompt_id_project_unique: {
            id: promptName,
            projectId: currentProjectId,
          },
        },
        select: { id: true, name: true, type: true, projectId: true, tenantId: true },
      });

      if (!promptToExecute) {
        // Attempt 2: Treat promptName as a name/slug to be slugified
        const nameToSearch = slugify(promptName);
        this.logger.debug(
          `🚀 [EXECUTE PROMPT] Prompt not found by direct ID lookup. Attempting to fetch by slugified name: "${nameToSearch}" (original input: "${promptName}") in project "${currentProjectId}"`,
        );
        promptToExecute = await this.prisma.prompt.findUnique({
          where: {
            prompt_id_project_unique: {
              id: nameToSearch, // Using slugified name as the ID here based on schema
              projectId: currentProjectId,
            },
          },
          // Fetch versions only when we are confident this is the prompt (by slug)
          select: { id: true, name: true, type: true, projectId: true, tenantId: true, versions: { orderBy: { createdAt: 'desc' }, include: { translations: true } } },
        });
      }
    }

    if (!promptToExecute || !promptToExecute.id) {
      this.logger.error(
        `Prompt "${promptName}" not found in project "${currentProjectId}".`,
      );
      throw new NotFoundException(
        `Prompt "${promptName}" not found in project "${currentProjectId}".`,
      );
    }
    if (!promptToExecute.versions) {
      const tempPromptWithVersions = await this.prisma.prompt.findUnique({ where: { prompt_id_project_unique: { id: promptToExecute.id, projectId: currentProjectId } }, select: { versions: { orderBy: { createdAt: 'desc' }, include: { translations: true } } } });
      promptToExecute.versions = tempPromptWithVersions?.versions || [];
    }
    const resolvedPrompt = promptToExecute as Prompt & { versions: (PromptVersion & { translations: PromptTranslation[] })[] };

    if (processedPrompts.has(promptNameSlug)) {
      this.logger.warn(
        `Circular reference for prompt "${promptName}" (slug: "${promptNameSlug}"). Path: ${Array.from(processedPrompts).join(' -> ')} -> ${promptNameSlug}`,
      );
      throw new BadRequestException(
        `Circular reference detected for prompt "${promptName}". Path: ${Array.from(processedPrompts).join(' -> ')} -> ${promptNameSlug}`,
      );
    }
    processedPrompts.add(promptNameSlug);

    this.logger.log(
      `Processing prompt "${resolvedPrompt.name}" (ID: "${resolvedPrompt.id}", Type: ${resolvedPrompt.type})`,
    );

    let textForProcessing: string = '';
    let versionUsedForProcessing: (typeof resolvedPrompt.versions)[0] | undefined = undefined;
    let languageUsedInVersion = 'base_language';

    if (resolvedPrompt.versions && resolvedPrompt.versions.length > 0) {
      const targetVersionTag = versionTag === 'latest' ? undefined : versionTag;
      if (targetVersionTag) {
        versionUsedForProcessing = resolvedPrompt.versions.find(v => v.versionTag === targetVersionTag);
      }
      if (!versionUsedForProcessing) { versionUsedForProcessing = resolvedPrompt.versions[0]; }
    }
    if (!versionUsedForProcessing) {
      throw new NotFoundException(`No version for prompt "${resolvedPrompt.name}" (tag: ${versionTag || 'latest'}).`);
    }

    // Minimal debug for version used
    this.logger.debug(`Using version ID: ${versionUsedForProcessing.id}`);

    textForProcessing = versionUsedForProcessing.promptText;
    languageUsedInVersion = 'base_language';
    if (languageCode && versionUsedForProcessing.translations?.length) {
      const translation = versionUsedForProcessing.translations.find(t => t.languageCode === languageCode);
      if (translation) {
        textForProcessing = translation.promptText;
        languageUsedInVersion = languageCode;
      } else { languageUsedInVersion = 'base_language_fallback'; }
    }

    if (resolvedPrompt.type === 'TEMPLATE') {
      this.logger.log(`Prompt "${resolvedPrompt.name}" is TEMPLATE, content will be processed.`);
    }

    const { processedText: textWithAssetsAndVars, resolvedAssetsMetadata } = await this.resolveAssets(
      textForProcessing,
      resolvedPrompt.id,
      resolvedPrompt.projectId,
      languageCode,
      variables,
    );
    const { processedText: finalTextAfterRefResolution, resolvedPromptsMetadata } = await this.resolvePromptReferences(
      textWithAssetsAndVars,
      resolvedPrompt.projectId,
      body,
      languageCode,
      processedPrompts,
      {
        currentPromptType: resolvedPrompt.type,
        currentDepth: currentDepth,
        maxDepth,
      },
    );

    const metadata = {
      projectId: currentProjectId,
      promptName: resolvedPrompt.name,
      promptId: resolvedPrompt.id,
      promptType: resolvedPrompt.type,
      promptVersionId: versionUsedForProcessing.id,
      promptVersionTag: versionUsedForProcessing.versionTag,
      languageUsed: languageUsedInVersion,
      assetsUsed: resolvedAssetsMetadata,
      variablesProvided: Object.keys(variables || {}),
      resolvedPrompts: resolvedPromptsMetadata,
    };

    return { processedPrompt: finalTextAfterRefResolution, metadata };
  }
}
