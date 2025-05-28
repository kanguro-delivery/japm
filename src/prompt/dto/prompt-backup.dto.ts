import { ApiProperty } from '@nestjs/swagger';

export interface PromptBackupDto {
    // Metadata del backup
    backupMetadata: {
        timestamp: string;
        backupVersion: string;
        deletionReason?: string;
        deletedBy: string;
        tenantId: string;
        projectId: string;
    };

    // Datos del prompt principal
    prompt: {
        id: string;
        name: string;
        description?: string;
        type: string;
        projectId: string;
        tenantId: string;
        createdAt: string;
        updatedAt: string;
    };

    // Versiones completas con sus traducciones
    versions: Array<{
        id: string;
        promptText: string;
        languageCode: string;
        versionTag: string;
        changeMessage?: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        aiModelId?: string;
        marketplaceStatus?: string;
        marketplacePublishedAt?: string;
        marketplaceRequestedAt?: string;
        marketplaceApprovedAt?: string;
        marketplaceRejectionReason?: string;

        // Traducciones de esta versión
        translations: Array<{
            id: string;
            languageCode: string;
            promptText: string;
            createdAt: string;
            updatedAt: string;
        }>;

        // Environments donde está activa
        activeInEnvironments: Array<{
            id: string;
            name: string;
        }>;
    }>;

    // Assets completos con sus versiones y traducciones
    assets: Array<{
        id: string;
        key: string;
        enabled: boolean;
        createdAt: string;
        updatedAt: string;

        // Versiones del asset
        versions: Array<{
            id: string;
            value: string;
            versionTag: string;
            changeMessage?: string;
            status: string;
            languageCode?: string;
            createdAt: string;
            updatedAt: string;
            marketplaceStatus?: string;
            marketplacePublishedAt?: string;
            marketplaceRequestedAt?: string;
            marketplaceApprovedAt?: string;
            marketplaceRejectionReason?: string;

            // Traducciones del asset
            translations: Array<{
                id: string;
                languageCode: string;
                value: string;
                createdAt: string;
                updatedAt: string;
            }>;

            // Environments donde está activa
            activeInEnvironments: Array<{
                id: string;
                name: string;
            }>;
        }>;
    }>;

    // Tags asociados
    tags: Array<{
        id: string;
        name: string;
        description?: string;
    }>;

    // Logs de ejecución (muestra reciente)
    executionLogs: Array<{
        id: string;
        timestamp: string;
        promptVersionId: string;
        environmentId?: string;
        userId?: string;
        input: string;
        output: string;
        success: boolean;
        durationMs?: number;
        errorMessage?: string;
    }>;

    // Estadísticas de uso
    statistics: {
        totalVersions: number;
        totalTranslations: number;
        totalAssets: number;
        totalAssetVersions: number;
        totalAssetTranslations: number;
        totalExecutions: number;
        lastExecutionDate?: string;
        mostUsedLanguages: Array<{
            languageCode: string;
            count: number;
        }>;
    };
}

export class CreatePromptBackupRequestDto {
    @ApiProperty({
        description: 'Razón opcional para el borrado',
        example: 'Prompt deprecated and replaced by v2',
        required: false,
    })
    deletionReason?: string;

    @ApiProperty({
        description: 'Incluir logs de ejecución en el backup (puede ser pesado)',
        example: true,
        default: false,
    })
    includeExecutionLogs?: boolean;

    @ApiProperty({
        description: 'Límite de logs de ejecución a incluir',
        example: 100,
        default: 50,
    })
    executionLogsLimit?: number;
} 