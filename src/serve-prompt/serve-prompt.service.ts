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
  PromptAssetVersion,
  PromptTranslation,
  AssetTranslation,
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
    this.logger.debug(
      `🔧 [RESOLVE ASSETS] Starting asset resolution for prompt "${promptIdInput}" in project "${projectIdInput}"${languageCode ? ` with language "${languageCode}"` : ''}`,
    );
    this.logger.debug(
      `🔧 [RESOLVE ASSETS] Input text: "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"`,
    );
    this.logger.debug(
      `🔧 [RESOLVE ASSETS] Input variables: ${JSON.stringify(inputVariables)}`,
    );

    let processedText = text;
    const assetContext: Record<string, string> = {};
    const resolvedAssetsMetadata: any[] = [];

    // Buscar placeholders de activos, excluyendo aquellos que corresponden a variables del input
    const allAssetMatches = [...text.matchAll(/\{\{asset:([^}]+)\}\}/g)];
    this.logger.debug(
      `🔧 [RESOLVE ASSETS] Found ${allAssetMatches.length} asset placeholder(s): ${allAssetMatches.map((m) => m[0]).join(', ')}`,
    );

    const assetSpecifications = allAssetMatches
      .filter((match) => {
        const placeholderContent = match[1].trim();
        const [key] = placeholderContent.split(':');
        const isVariable = inputVariables.hasOwnProperty(key);
        if (isVariable) {
          this.logger.debug(
            `🔧 [RESOLVE ASSETS] Skipping asset placeholder "${match[0]}" because "${key}" is provided as a variable`,
          );
        }
        return !isVariable;
      })
      .map((match) => {
        const placeholderContent = match[1].trim();
        const [key, versionTag] = placeholderContent.split(':');
        return { key, versionTag, placeholderContent };
      });

    this.logger.debug(
      `🔧 [RESOLVE ASSETS] After filtering variables, ${assetSpecifications.length} asset(s) to resolve: ${assetSpecifications.map((s) => s.key).join(', ')}`,
    );

    if (assetSpecifications.length > 0) {
      const uniqueAssetKeys = [
        ...new Set(assetSpecifications.map((spec) => spec.key)),
      ];
      this.logger.debug(
        `🔧 [RESOLVE ASSETS] Unique asset keys to search: ${uniqueAssetKeys.join(', ')}`,
      );

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

      this.logger.debug(
        `🔧 [RESOLVE ASSETS] Found ${foundAssets.length} asset(s) in database for prompt "${promptIdInput}"`,
      );

      for (const asset of foundAssets) {
        if (asset.versions && asset.versions.length > 0) {
          const latestVersion = asset.versions[0];
          this.logger.debug(
            `🔧 [RESOLVE ASSETS] Asset "${asset.key}": Latest version ID="${latestVersion.id}", tag="${latestVersion.versionTag}", status="${latestVersion.status}", translations=${latestVersion.translations.length}`,
          );
        } else {
          this.logger.debug(
            `🔧 [RESOLVE ASSETS] Asset "${asset.key}": No versions found`,
          );
        }
      }

      for (const spec of assetSpecifications) {
        const asset = foundAssets.find((a) => a.key === spec.key);
        if (!asset) {
          this.logger.warn(
            `⚠️ [RESOLVE ASSETS] Asset with key "${spec.key}" (referenced as "{{${spec.placeholderContent}}}") not found for prompt "${promptIdInput}" in project "${projectIdInput}".`,
          );
          continue;
        }

        const assetVersions = asset.versions;
        if (!assetVersions) {
          this.logger.warn(
            `⚠️ [RESOLVE ASSETS] Asset key "${spec.key}" for prompt "${promptIdInput}" found, but versions array is unexpectedly undefined.`,
          );
          continue;
        }

        let targetVersion: (typeof assetVersions)[0] | undefined = undefined;

        if (spec.versionTag) {
          this.logger.debug(
            `🔧 [RESOLVE ASSETS] Looking for specific version "${spec.versionTag}" for asset "${spec.key}"`,
          );
          targetVersion = assetVersions.find(
            (v) => v.versionTag === spec.versionTag,
          );
          if (!targetVersion) {
            this.logger.warn(
              `⚠️ [RESOLVE ASSETS] Asset key "${spec.key}", version "${spec.versionTag}" not found. Falling back to latest active version.`,
            );
          }
        }

        if (!targetVersion) {
          this.logger.debug(
            `🔧 [RESOLVE ASSETS] Looking for active version for asset "${spec.key}"`,
          );
          targetVersion = assetVersions.find((v) => v.status === 'active');
        }

        if (targetVersion) {
          let assetValue = targetVersion.value;
          let languageSource = 'base_asset';

          this.logger.debug(
            `✅ [RESOLVE ASSETS] Found target version for asset "${spec.key}": version="${targetVersion.versionTag}", value="${assetValue.substring(0, 100)}${assetValue.length > 100 ? '...' : ''}"`,
          );

          if (languageCode) {
            this.logger.debug(
              `🌐 [RESOLVE ASSETS] Looking for translation in language "${languageCode}" for asset "${spec.key}"`,
            );
            const translation = targetVersion.translations.find(
              (t) => t.languageCode === languageCode,
            );
            if (translation) {
              assetValue = translation.value;
              languageSource = languageCode;
              this.logger.debug(
                `✅ [RESOLVE ASSETS] Found translation for asset "${spec.key}" in "${languageCode}": "${assetValue.substring(0, 100)}${assetValue.length > 100 ? '...' : ''}"`,
              );
            } else {
              this.logger.warn(
                `⚠️ [RESOLVE ASSETS] Asset key "${spec.key}" v${targetVersion.versionTag}: No translation found for "${languageCode}". Using base value.`,
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

          this.logger.debug(
            `✅ [RESOLVE ASSETS] Asset "${spec.key}" resolved successfully. Value will replace "{{${spec.placeholderContent}}}"`,
          );
        } else {
          this.logger.warn(
            `⚠️ [RESOLVE ASSETS] Asset key "${spec.key}" for prompt "${promptIdInput}" found, but no suitable version (specified: ${spec.versionTag || 'any active'}) could be resolved.`,
          );
        }
      }
    }

    // Procesar variables con la nueva sintaxis
    const variableContext: Record<string, string> = {};
    const variablePlaceholders = [
      ...text.matchAll(/\{\{variable:([^}]+)\}\}/g),
    ];

    this.logger.debug(
      `🔧 [RESOLVE ASSETS] Found ${variablePlaceholders.length} variable placeholder(s): ${variablePlaceholders.map((m) => m[0]).join(', ')}`,
    );

    for (const match of variablePlaceholders) {
      const placeholder = match[0];
      const variableName = match[1].trim();

      if (inputVariables.hasOwnProperty(variableName)) {
        const variableValue = String(inputVariables[variableName]);
        variableContext[variableName] = variableValue;
        this.logger.debug(
          `✅ [RESOLVE ASSETS] Variable "${variableName}" resolved: "${variableValue.substring(0, 100)}${variableValue.length > 100 ? '...' : ''}"`,
        );
      } else {
        this.logger.warn(
          `⚠️ [RESOLVE ASSETS] Variable "${variableName}" (referenced as "${placeholder}") not provided in input variables. Available variables: ${Object.keys(inputVariables).join(', ') || 'none'}`,
        );
      }
    }

    // Reemplazar assets primero
    this.logger.debug(
      `🔄 [RESOLVE ASSETS] Replacing ${Object.keys(assetContext).length} asset placeholder(s)`,
    );
    for (const [placeholderContent, assetValue] of Object.entries(
      assetContext,
    )) {
      const placeholder = `{{asset:${placeholderContent}}}`;
      processedText = processedText.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        assetValue,
      );
      this.logger.debug(
        `🔄 [RESOLVE ASSETS] Replaced "${placeholder}" with asset value`,
      );
    }

    // Luego reemplazar variables
    this.logger.debug(
      `🔄 [RESOLVE ASSETS] Replacing ${Object.keys(variableContext).length} variable placeholder(s)`,
    );
    for (const [variableName, variableValue] of Object.entries(
      variableContext,
    )) {
      const placeholder = `{{variable:${variableName}}}`;
      processedText = processedText.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        variableValue,
      );
      this.logger.debug(
        `🔄 [RESOLVE ASSETS] Replaced "${placeholder}" with variable value`,
      );
    }

    this.logger.debug(
      `🎯 [RESOLVE ASSETS] Asset and variable resolution completed. Final text: "${processedText.substring(0, 200)}${processedText.length > 200 ? '...' : ''}"`,
    );
    this.logger.debug(
      `📊 [RESOLVE ASSETS] Summary - Assets resolved: ${resolvedAssetsMetadata.length}, Variables resolved: ${Object.keys(variableContext).length}`,
    );

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

    // Regex para encontrar {{prompt:projectId/slug:versionTag}} o {{prompt:slug:versionTag}}
    // o {{prompt:projectId/slug}} o {{prompt:slug}}
    const promptRefRegex = /\{\{prompt:(([^:}]+?)\/)?([^:}]+?)(?::([^}]+))?\}\}/g;
    let match;

    while ((match = promptRefRegex.exec(currentText)) !== null) {
      const fullMatch = match[0];
      const specifiedProjectId = match[2]; // Puede ser undefined si no se especifica projectId/
      const referencedPromptIdentifier = match[3]; // slug o ID del prompt referenciado
      const referencedVersionTag = match[4]; // versionTag opcional

      const projectIdForNestedPrompt = specifiedProjectId || currentProcessingProjectId;

      this.logger.debug(
        `[RESOLVE PROMPT REF] Found reference: ${fullMatch}. Project for nested: "${projectIdForNestedPrompt}", Identifier: "${referencedPromptIdentifier}", Version: "${referencedVersionTag || 'latest'}"`,
      );

      const uniqueRefKey = `${projectIdForNestedPrompt}/${referencedPromptIdentifier}`;
      if (processedPrompts.has(uniqueRefKey)) {
        const errorMessage = `Circular reference detected for prompt: "${referencedPromptIdentifier}" in project "${projectIdForNestedPrompt}". Path: ${Array.from(processedPrompts).join(' -> ')} -> ${uniqueRefKey}`;
        this.logger.error(`[RESOLVE PROMPT REF] ${errorMessage}`);
        throw new BadRequestException(errorMessage);
      }
      processedPrompts.add(uniqueRefKey);

      try {
        this.logger.debug(
          `[RESOLVE PROMPT REF] Calling executePromptVersion for nested: Project="${projectIdForNestedPrompt}", Identifier="${referencedPromptIdentifier}", Version="${referencedVersionTag || 'latest'}"`,
        );
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
            `[RESOLVE PROMPT REF] HttpException during recursive call for "${uniqueRefKey}": ${error.message}. Propagating error.`,
          );
          throw error;
        }

        this.logger.error(
          `[RESOLVE PROMPT REF] Unexpected error during recursive call to executePromptVersion for "${uniqueRefKey}": ${error.message}`,
          error.stack,
        );
        resolvedPromptsMetadata.push({
          type: 'error',
          message: `Failed to resolve nested prompt: ${referencedPromptIdentifier}. Error: ${error.message}`,
          promptIdentifier: referencedPromptIdentifier,
          projectId: projectIdForNestedPrompt,
        });
        // No reemplazar el texto, dejar el placeholder original si hay un error inesperado no-HTTP.
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

    // 🚨🚨🚨 SUPER OBVIOUS LOG TO CONFIRM CODE IS UPDATED 🚨🚨🚨
    console.log(
      `🚨🚨🚨 [SUPER OBVIOUS] executePromptVersion called with promptName: "${promptName}", project: "${projectId}", depth: ${currentDepth} 🚨🚨🚨`,
    );

    this.logger.debug(
      `🚀 [EXECUTE PROMPT] Starting execution of prompt "${promptName}" v${versionTag} in project "${projectId}"${languageCode ? ` with language "${languageCode}"` : ''} (depth: ${currentDepth})`,
    );
    this.logger.debug(
      `🚀 [EXECUTE PROMPT] Variables provided: ${JSON.stringify(variables || {})}`,
    );

    // Check for circular references and max depth
    if (currentDepth >= maxDepth) {
      this.logger.warn(
        `⚠️ [EXECUTE PROMPT] Maximum depth (${maxDepth}) reached for prompt "${promptName}". Stopping execution.`,
      );
      throw new BadRequestException(
        `Maximum prompt reference depth (${maxDepth}) reached. Possible circular reference involving "${promptName}".`,
      );
    }

    const promptNameSlug = slugify(promptName);
    const currentProjectId = projectId;
    let promptToExecute: Prompt | null = null;

    // Heuristic to determine if promptName is a CUID vs a name/slug
    const isCuidLike = promptName && promptName.length === 25 && promptName.startsWith('c');

    if (isCuidLike) {
      this.logger.debug(
        `🚀 [EXECUTE PROMPT] Input "${promptName}" looks like a CUID. Attempting to fetch by CUID in project "${currentProjectId}"`,
      );
      promptToExecute = await this.prisma.prompt.findUnique({
        where: {
          prompt_id_project_unique: {
            id: promptName,
            projectId: currentProjectId,
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          projectId: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    // If not found by CUID pattern, or if it wasn't CUID-like, try other methods
    if (!promptToExecute) {
      if (isCuidLike) { // Log if CUID-like attempt failed
        this.logger.debug(
          `🚀 [EXECUTE PROMPT] CUID-like input "${promptName}" not found by CUID lookup. Proceeding to other lookup methods.`
        );
      }

      this.logger.debug(
        `🚀 [EXECUTE PROMPT] Input "${promptName}" not CUID-like or not found by CUID. Attempting direct ID lookup in project "${currentProjectId}".`
      );
      // Attempt 1: Treat promptName as a potential pre-existing ID (e.g., from seed or direct CUID-like string passed as non-slug name)
      promptToExecute = await this.prisma.prompt.findUnique({
        where: {
          prompt_id_project_unique: {
            id: promptName,
            projectId: currentProjectId,
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          projectId: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
        },
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
              id: nameToSearch,
              projectId: currentProjectId,
            },
          },
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            projectId: true,
            tenantId: true,
            createdAt: true,
            updatedAt: true,
            versions: {
              orderBy: { createdAt: 'desc' },
              include: { translations: true },
            },
          },
        });
      }
    }

    if (!promptToExecute) {
      this.logger.error(
        `❌ [EXECUTE PROMPT] Prompt with identifier "${promptName}" not found in project "${currentProjectId}". Searched by CUID (if applicable) and by name/slug.`,
      );
      throw new NotFoundException(
        `Prompt with identifier "${promptName}" not found in project "${currentProjectId}".`,
      );
    }
    const prompt = promptToExecute;

    this.logger.debug(
      `🚀 [EXECUTE PROMPT] Converted prompt name "${promptName}" to slug "${promptNameSlug}"`,
    );

    // Check for circular references using the slug for consistency
    if (processedPrompts.has(promptNameSlug)) {
      this.logger.warn(
        `⚠️ [EXECUTE PROMPT] Circular reference detected for prompt "${promptName}" (slug: "${promptNameSlug}"). Stopping execution.`,
      );
      throw new BadRequestException(
        `Circular reference detected for prompt "${promptName}".`,
      );
    }

    // Add current prompt to processed set using slug for consistency
    processedPrompts.add(promptNameSlug);

    this.logger.debug(
      `[EXECUTE PROMPT] Finding prompt by name "${promptNameSlug}" (original: "${promptName}") in project "${projectId}" for full details`,
    );
    // This is the main fetch for the prompt that will be processed.
    // It needs to select all necessary scalar fields and relations.
    const fullyFetchedPrompt = await this.prisma.prompt.findUnique({
      where: {
        prompt_id_project_unique: {
          id: promptNameSlug,
          projectId: projectId,
        },
      },
      // Explicit select to ensure all fields and relations are available and typed correctly
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        projectId: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        versions: { // Include versions with their translations
          orderBy: { createdAt: 'desc' },
          include: {
            translations: true,
          },
        },
        // No direct 'translations' on Prompt model
      },
    });

    if (!fullyFetchedPrompt) {
      // This case should ideally be caught by earlier checks that populate promptToExecute
      // but as a safeguard:
      throw new NotFoundException(
        `Prompt with slug "${promptNameSlug}" (from name "${promptName}") not found in project "${projectId}" during final fetch.`,
      );
    }

    // Use the fully fetched prompt from now on.
    const resolvedPrompt = fullyFetchedPrompt;

    this.logger.log(
      `[EXECUTE PROMPT] Prompt "${resolvedPrompt.name}" (ID: "${resolvedPrompt.id}") found for execution. Type: ${resolvedPrompt.type}`,
    );

    let textForProcessing: string = '';
    let versionUsedForProcessing: (typeof resolvedPrompt.versions)[0] | undefined = undefined;
    let languageUsedInVersion = 'base_language';


    if (resolvedPrompt.versions && resolvedPrompt.versions.length > 0) {
      const targetVersionTag = versionTag === 'latest' ? undefined : versionTag;
      if (targetVersionTag) {
        versionUsedForProcessing = resolvedPrompt.versions.find(v => v.versionTag === targetVersionTag);
      }
      if (!versionUsedForProcessing) { // Fallback to latest (first in desc order due to orderBy)
        versionUsedForProcessing = resolvedPrompt.versions[0];
      }
    }

    if (!versionUsedForProcessing) {
      throw new NotFoundException(
        `No suitable version found for prompt "${resolvedPrompt.name}" (tag searched: ${versionTag || 'latest'}). Project: "${projectId}"`,
      );
    }

    this.logger.debug(
      `[EXECUTE PROMPT] Using version: ID="${versionUsedForProcessing.id}", Tag="${versionUsedForProcessing.versionTag}" for prompt "${resolvedPrompt.name}"`,
    );

    textForProcessing = versionUsedForProcessing.promptText;
    languageUsedInVersion = 'base_language';

    if (languageCode && versionUsedForProcessing.translations && versionUsedForProcessing.translations.length > 0) {
      const translation = versionUsedForProcessing.translations.find(t => t.languageCode === languageCode);
      if (translation) {
        textForProcessing = translation.promptText;
        languageUsedInVersion = languageCode;
        this.logger.debug(`[EXECUTE PROMPT] Applied translation for language: ${languageCode}`);
      } else {
        languageUsedInVersion = 'base_language_fallback';
        this.logger.debug(`[EXECUTE PROMPT] Translation for ${languageCode} not found, using base text.`);
      }
    }


    // 1. Si el prompt es un TEMPLATE, su texto simplemente se usa como está.
    // La resolución de la referencia {{prompt:otro_prompt_slug}} ocurrirá
    // más adelante en la llamada a this.resolvePromptReferences.
    if (resolvedPrompt.type === 'TEMPLATE') {
      this.logger.log(
        `[EXECUTE PROMPT] Prompt "${resolvedPrompt.name}" is a TEMPLATE. Its text will be processed for further references.`,
      );
      // No se necesita hacer nada especial aquí para cargar el prompt referenciado,
      // ya que textForProcessing ya tiene el contenido de la versión del TEMPLATE.
      // La lógica de resolvePromptReferences se encargará de las sub-referencias.
    }

    this.logger.debug(
      `🔄 [EXECUTE PROMPT] Starting asset and variable resolution with text: "${textForProcessing.substring(0, 100)}..."`,
    );

    // Then resolve assets and variables using the determined textForProcessing
    const { processedText: textWithAssetsAndVars, resolvedAssetsMetadata } = await this.resolveAssets(
      textForProcessing,
      resolvedPrompt.id,
      resolvedPrompt.projectId,
      languageCode,
      variables,
    );

    const finalProcessedText = textWithAssetsAndVars; // Placeholder for potential further processing like prompt references

    // TODO: Re-evaluate if resolvePromptReferences is needed here if template logic already resolves them.
    // If textForProcessing came from a resolved referenced prompt, it might already have its internal references resolved.
    // For now, let's assume resolvePromptReferences handles its own idempotency or context.
    const { processedText: finalTextAfterRefResolution, resolvedPromptsMetadata } = await this.resolvePromptReferences(
      finalProcessedText,
      resolvedPrompt.projectId,
      body,
      languageCode,
      processedPrompts,
      {
        currentPromptType: resolvedPrompt.type,
        currentDepth: currentDepth + 1,
        maxDepth,
      },
    );


    this.logger.debug(
      `✅ [EXECUTE PROMPT] Asset and variable resolution completed.`,
    );
    this.logger.debug(
      `📊 [EXECUTE PROMPT] Resolved ${resolvedAssetsMetadata.length} asset(s): ${resolvedAssetsMetadata.map((a) => a.key).join(', ')}`,
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

    this.logger.debug(
      `🎯 [EXECUTE PROMPT] Execution completed successfully. Metadata: ${JSON.stringify(metadata, null, 2)}`,
    );

    return { processedPrompt: finalTextAfterRefResolution, metadata };
  }

  // Keep the old servePrompt method commented or remove if fully deprecated
  /*
    async servePrompt(
        promptName: string,
        languageCode: string,
        versionTag?: string,
        context?: Record<string, any>
    ): Promise<{ processedPrompt: string; metadata: any }> { ... old code ... }
    */
}

// Nota: Faltaría implementar la lógica para crear/actualizar prompts, versiones y traducciones.
// Esta función solo se encarga de servir el prompt ensamblado.
// -->
// Note: Logic for creating/updating prompts, versions, and translations would still need implementation.
// This function is only responsible for serving the assembled prompt.
