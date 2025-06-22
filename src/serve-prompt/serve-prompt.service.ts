import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutePromptParamsDto } from './dto/execute-prompt-params.dto';
import { ExecutePromptBodyDto } from './dto/execute-prompt-body.dto';
import { ExecutePromptQueryDto } from './dto/execute-prompt-query.dto';
import { PromptAsset, PromptAssetVersion } from '@prisma/client';

type PromptAssetWithVersions = PromptAsset & {
  versions: PromptAssetVersion[];
};

interface PromptExecutionMetadata {
  projectId: string;
  promptName: string;
  promptId: string;
  promptType: string;
  promptVersionId: string;
  promptVersionTag: string;
  languageUsed: string;
  assetsUsed: any[];
  variablesProvided: string[];
  resolvedPrompts: any[];
  unresolvedPromptPlaceholders: string[];
}

@Injectable()
export class ServePromptService {
  private readonly logger = new Logger(ServePromptService.name);

  constructor(private prisma: PrismaService) { }

  async resolveAssets(
    text: string,
    promptIdInput: string,
    projectIdInput: string,
    languageCode?: string,
    inputVariables: Record<string, any> = {},
  ): Promise<{
    processedText: string;
    resolvedAssetsMetadata: any[];
    unresolvedVariables: string[];
  }> {
    let processedText = text;
    const assetContext: Record<string, string> = {};
    const resolvedAssetsMetadata: any[] = [];
    const unresolvedVariables: string[] = [];

    const allAssetMatches = [...text.matchAll(/\{\{asset:([^}]+)\}\}/g)];

    const assetSpecifications = allAssetMatches
      .filter((match) => {
        const placeholderContent = match[1].trim();
        const [key] = placeholderContent.split(':');
        return !Object.prototype.hasOwnProperty.call(inputVariables, key);
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
          targetVersion = assetVersions.find(
            (v) => v.versionTag === spec.versionTag,
          );
          if (!targetVersion) {
            this.logger.warn(
              `Asset key "${spec.key}", version "${spec.versionTag}" not found. Falling back to latest active version.`,
            );
          }
        }
        if (!targetVersion) {
          targetVersion =
            assetVersions.find((v) => v.status === 'active') ||
            assetVersions[0];
        }
        if (targetVersion) {
          let assetValue = targetVersion.value;
          let languageSource = 'base_asset';
          if (languageCode) {
            const translation = targetVersion.translations.find(
              (t) => t.languageCode === languageCode,
            );
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
    const variablePlaceholders = [
      ...text.matchAll(/\{\{variable:([^}]+)\}\}/g),
    ];
    for (const match of variablePlaceholders) {
      const placeholder = match[0];
      const variableName = match[1].trim();
      if (Object.prototype.hasOwnProperty.call(inputVariables, variableName)) {
        variableContext[variableName] = String(inputVariables[variableName]);
      } else {
        this.logger.warn(
          `Variable "${variableName}" (referenced as "${placeholder}") not provided. Available: ${Object.keys(inputVariables).join(', ') || 'none'}`,
        );
        unresolvedVariables.push(variableName);
      }
    }

    for (const [placeholderContent, assetValue] of Object.entries(
      assetContext,
    )) {
      const placeholder = `{{asset:${placeholderContent}}}`;
      processedText = processedText.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        assetValue,
      );
    }
    for (const [variableName, variableValue] of Object.entries(
      variableContext,
    )) {
      const placeholder = `{{variable:${variableName}}}`;
      processedText = processedText.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        variableValue,
      );
    }

    const simpleVarRegex = /\{\{(?!asset:|variable:)([^}]+?)\}\}/g;
    const matches = [...processedText.matchAll(simpleVarRegex)];

    for (const match of matches) {
      const placeholder = match[0];
      const varName = match[1].trim();
      if (Object.prototype.hasOwnProperty.call(inputVariables, varName)) {
        const valueToReplace = String(inputVariables[varName]);
        processedText = processedText.split(placeholder).join(valueToReplace);
      } else {
        unresolvedVariables.push(varName);
      }
    }

    return {
      processedText,
      resolvedAssetsMetadata,
      unresolvedVariables: [...new Set(unresolvedVariables)],
    };
  }

  private async resolvePromptReferences(
    text: string,
    currentProcessingProjectId: string,
    body: ExecutePromptBodyDto,
    query: ExecutePromptQueryDto,
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
    const promptRefRegex =
      /\{\{prompt:(([^:}]+?)\/)?([^:}]+?)(?::([^}]+))?\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = promptRefRegex.exec(currentText)) !== null) {
      const fullMatch = match[0];
      const specifiedProjectId = match[2];
      const referencedPromptIdentifier = match[3];
      const referencedVersionTag = match[4];
      const projectIdForNestedPrompt =
        specifiedProjectId || currentProcessingProjectId;

      this.logger.debug(`Found prompt reference: ${fullMatch}`);

      const uniqueRefKey = `${projectIdForNestedPrompt}/${referencedPromptIdentifier}`;
      if (processedPrompts.has(uniqueRefKey)) {
        const errorMessage = `Circular reference detected for prompt: "${referencedPromptIdentifier}" in project "${projectIdForNestedPrompt}". Path: ${Array.from(processedPrompts).join(' -> ')} -> ${uniqueRefKey}`;
        this.logger.error(`[RESOLVE PROMPT REF] ${errorMessage}`);
        throw new BadRequestException(errorMessage);
      }
      processedPrompts.add(uniqueRefKey);

      try {
        this.logger.debug(
          `Calling executePromptVersion for nested: ${uniqueRefKey}`,
        );
        const nestedResult = await this.executePromptVersion(
          {
            projectId: projectIdForNestedPrompt,
            promptName: referencedPromptIdentifier,
            versionTag: referencedVersionTag || 'latest',
            languageCode: languageCode,
          },
          body,
          query,
          new Set(processedPrompts),
          {
            currentDepth: currentDepth + 1,
            maxDepth,
          },
        );
        currentText = currentText.replace(
          fullMatch,
          nestedResult.processedPrompt,
        );
        if (nestedResult.metadata?.resolvedPrompts) {
          resolvedPromptsMetadata.push(
            ...nestedResult.metadata.resolvedPrompts,
          );
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
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Unexpected error during recursive call for "${uniqueRefKey}": ${message}`,
          stack,
        );
        resolvedPromptsMetadata.push({
          type: 'error',
          message: `Failed to resolve nested prompt: ${referencedPromptIdentifier}. Error: ${message}`,
          promptIdentifier: referencedPromptIdentifier,
          projectId: projectIdForNestedPrompt,
        });
      }
    }
    return { processedText: currentText, resolvedPromptsMetadata };
  }

  async executePromptVersion(
    params: ExecutePromptParamsDto,
    body: ExecutePromptBodyDto,
    query: ExecutePromptQueryDto = {},
    processedPrompts: Set<string> = new Set(),
    context: {
      currentDepth?: number;
      maxDepth?: number;
    } = {},
  ): Promise<{
    processedPrompt: string;
    metadata: PromptExecutionMetadata;
    assets?: any[];
  }> {
    const { projectId, promptName, versionTag, languageCode } = params;
    const { variables } = body;
    const { currentDepth = 0, maxDepth = 5 } = context;

    this.logger.log(
      `[executePromptVersion] Initiating execution for prompt: "${promptName}" (v: ${versionTag || 'latest'}) in project: "${projectId}" with language: ${languageCode || 'base'}`,
    );
    this.logger.debug(
      `[executePromptVersion] Variables received: ${JSON.stringify(variables)}`,
    );

    if (currentDepth >= maxDepth) {
      this.logger.warn(
        `Maximum depth (${maxDepth}) reached for prompt "${promptName}".`,
      );
      throw new BadRequestException(
        `Maximum depth (${maxDepth}) reached for prompt "${promptName}".`,
      );
    }

    const prompt = await this.prisma.prompt.findUnique({
      where: {
        prompt_id_project_unique: {
          id: promptName,
          projectId: projectId,
        },
      },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            translations: true,
          },
        },
        assets: query?.includeAssets
          ? {
            include: {
              versions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          }
          : false,
      },
    });

    if (!prompt) {
      this.logger.error(
        `[executePromptVersion] Prompt with name/id "${promptName}" not found in project "${projectId}".`,
      );
      throw new NotFoundException(
        `Prompt with name/id "${promptName}" not found in project "${projectId}"`,
      );
    }
    this.logger.log(`[executePromptVersion] Found prompt ID: ${prompt.id}`);

    let targetVersion: (typeof prompt.versions)[0] | undefined;

    if (versionTag && versionTag.toLowerCase() !== 'latest') {
      targetVersion = prompt.versions.find((v) => v.versionTag === versionTag);
      if (!targetVersion) {
        this.logger.error(
          `[executePromptVersion] Version with tag "${versionTag}" for prompt "${prompt.name}" not found.`,
        );
        throw new NotFoundException(
          `Version with tag "${versionTag}" for prompt "${prompt.name}" not found.`,
        );
      }
    } else {
      targetVersion =
        prompt.versions.find((v) => v.status === 'active') ||
        prompt.versions[0];
      if (!targetVersion) {
        this.logger.error(
          `[executePromptVersion] No versions found for prompt "${prompt.name}".`,
        );
        throw new NotFoundException(
          `No versions found for prompt "${prompt.name}".`,
        );
      }
    }
    this.logger.log(
      `[executePromptVersion] Resolved to version ID: ${targetVersion.id} (Tag: ${targetVersion.versionTag}, Status: ${targetVersion.status})`,
    );

    let promptText = targetVersion.promptText;
    let languageSource = 'base_prompt';

    if (languageCode && targetVersion.translations?.length) {
      const translation = targetVersion.translations.find(
        (t) => t.languageCode === languageCode,
      );
      if (translation) {
        promptText = translation.promptText;
        languageSource = languageCode;
      } else {
        languageSource = 'base_language_fallback';
      }
    }

    if (query.processed === false) {
      this.logger.log(
        `[executePromptVersion] Bypassing processing for prompt "${prompt.name}" as requested.`,
      );
      const metadata: PromptExecutionMetadata = {
        projectId: projectId,
        promptName: prompt.name,
        promptId: prompt.id,
        promptType: prompt.type,
        promptVersionId: targetVersion.id,
        promptVersionTag: targetVersion.versionTag,
        languageUsed: languageSource,
        assetsUsed: [],
        variablesProvided: Object.keys(variables || {}),
        resolvedPrompts: [],
        unresolvedPromptPlaceholders: [],
      };
      const formattedAssets =
        query?.includeAssets && prompt.assets
          ? (prompt.assets as PromptAssetWithVersions[]).map((asset) => ({
            id: asset.id,
            key: asset.key,
            enabled: asset.enabled,
            versions: asset.versions.map((version) => ({
              id: version.id,
              value: version.value,
              versionTag: version.versionTag,
              languageCode: version.languageCode,
            })),
          }))
          : undefined;
      return {
        processedPrompt: promptText,
        metadata,
        assets: formattedAssets,
      };
    }

    if (prompt.type === 'TEMPLATE') {
      this.logger.log(
        `Prompt "${prompt.name}" is TEMPLATE, content will be processed.`,
      );
    }

    const {
      processedText: textWithAssetsAndVars,
      resolvedAssetsMetadata,
      unresolvedVariables,
    } = await this.resolveAssets(
      promptText,
      prompt.id,
      prompt.projectId,
      languageCode,
      variables,
    );
    const {
      processedText: finalTextAfterRefResolution,
      resolvedPromptsMetadata,
    } = await this.resolvePromptReferences(
      textWithAssetsAndVars,
      prompt.projectId,
      body,
      query,
      languageCode,
      processedPrompts,
      {
        currentPromptType: prompt.type,
        currentDepth: currentDepth,
        maxDepth,
      },
    );

    const metadata: PromptExecutionMetadata = {
      projectId: projectId,
      promptName: prompt.name,
      promptId: prompt.id,
      promptType: prompt.type,
      promptVersionId: targetVersion.id,
      promptVersionTag: targetVersion.versionTag,
      languageUsed: languageSource,
      assetsUsed: resolvedAssetsMetadata,
      variablesProvided: Object.keys(variables || {}),
      resolvedPrompts: resolvedPromptsMetadata,
      unresolvedPromptPlaceholders: unresolvedVariables,
    };

    let formattedAssets;
    if (query?.includeAssets && prompt.assets) {
      formattedAssets = (prompt.assets as PromptAssetWithVersions[]).map(
        (asset) => ({
          id: asset.id,
          key: asset.key,
          enabled: asset.enabled,
          versions: asset.versions.map((version) => ({
            id: version.id,
            value: version.value,
            versionTag: version.versionTag,
            languageCode: version.languageCode,
          })),
        }),
      );
    }

    return {
      processedPrompt: finalTextAfterRefResolution,
      metadata,
      assets: formattedAssets,
    };
  }
}
