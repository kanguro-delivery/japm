import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PromptBackupDto } from '../../prompt/dto/prompt-backup.dto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface PromptBackupOptions {
    includeExecutionLogs?: boolean;
    executionLogsLimit?: number;
    deletionReason?: string;
    deletedBy: string;
}

@Injectable()
export class PromptBackupService {
    private readonly logger = new Logger(PromptBackupService.name);
    private readonly backupDir: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        // Configurar directorio de backups
        this.backupDir = this.configService.get<string>('PROMPT_BACKUP_DIR') ||
            path.join(process.cwd(), 'storage', 'prompt-backups');
    }

    /**
     * Genera un backup completo de un prompt antes de su eliminación
     */
    async createPromptBackup(
        promptId: string,
        projectId: string,
        options: PromptBackupOptions,
    ): Promise<{ backupData: PromptBackupDto; backupPath?: string }> {
        this.logger.log(
            `Creating backup for prompt "${promptId}" in project "${projectId}"`,
        );

        try {
            // 1. Obtener el prompt completo con todas las relaciones
            const promptWithRelations = await this.getCompletePromptData(
                promptId,
                projectId,
                options,
            );

            if (!promptWithRelations) {
                throw new Error(`Prompt "${promptId}" not found in project "${projectId}"`);
            }

            // 2. Generar estadísticas de uso
            const statistics = await this.generateUsageStatistics(promptId);

            // 3. Estructurar el backup
            const backupData: PromptBackupDto = {
                backupMetadata: {
                    timestamp: new Date().toISOString(),
                    backupVersion: '1.0',
                    deletionReason: options.deletionReason,
                    deletedBy: options.deletedBy,
                    tenantId: promptWithRelations.tenantId,
                    projectId: promptWithRelations.projectId,
                },
                prompt: {
                    id: promptWithRelations.id,
                    name: promptWithRelations.name,
                    description: promptWithRelations.description ?? undefined,
                    type: promptWithRelations.type,
                    projectId: promptWithRelations.projectId,
                    tenantId: promptWithRelations.tenantId,
                    createdAt: promptWithRelations.createdAt.toISOString(),
                    updatedAt: promptWithRelations.updatedAt.toISOString(),
                },
                versions: promptWithRelations.versions.map((version) => ({
                    id: version.id,
                    promptText: version.promptText,
                    languageCode: version.languageCode,
                    versionTag: version.versionTag,
                    changeMessage: version.changeMessage ?? undefined,
                    status: version.status,
                    createdAt: version.createdAt.toISOString(),
                    updatedAt: version.updatedAt.toISOString(),
                    aiModelId: version.aiModelId ?? undefined,
                    marketplaceStatus: version.marketplaceStatus,
                    marketplacePublishedAt: version.marketplacePublishedAt?.toISOString(),
                    marketplaceRequestedAt: version.marketplaceRequestedAt?.toISOString(),
                    marketplaceApprovedAt: version.marketplaceApprovedAt?.toISOString(),
                    marketplaceRejectionReason: version.marketplaceRejectionReason ?? undefined,
                    translations: version.translations.map((translation) => ({
                        id: translation.id,
                        languageCode: translation.languageCode,
                        promptText: translation.promptText,
                        createdAt: translation.createdAt.toISOString(),
                        updatedAt: translation.updatedAt.toISOString(),
                    })),
                    activeInEnvironments: version.activeInEnvironments.map((env) => ({
                        id: env.id,
                        name: env.name,
                    })),
                })),
                assets: promptWithRelations.assets.map((asset) => ({
                    id: asset.id,
                    key: asset.key,
                    enabled: asset.enabled,
                    createdAt: asset.createdAt.toISOString(),
                    updatedAt: asset.updatedAt.toISOString(),
                    versions: asset.versions.map((version) => ({
                        id: version.id,
                        value: version.value,
                        versionTag: version.versionTag,
                        changeMessage: version.changeMessage ?? undefined,
                        status: version.status,
                        languageCode: version.languageCode ?? undefined,
                        createdAt: version.createdAt.toISOString(),
                        updatedAt: version.updatedAt.toISOString(),
                        marketplaceStatus: version.marketplaceStatus,
                        marketplacePublishedAt: version.marketplacePublishedAt?.toISOString(),
                        marketplaceRequestedAt: version.marketplaceRequestedAt?.toISOString(),
                        marketplaceApprovedAt: version.marketplaceApprovedAt?.toISOString(),
                        marketplaceRejectionReason: version.marketplaceRejectionReason ?? undefined,
                        translations: version.translations.map((translation) => ({
                            id: translation.id,
                            languageCode: translation.languageCode,
                            value: translation.value,
                            createdAt: translation.createdAt.toISOString(),
                            updatedAt: translation.updatedAt.toISOString(),
                        })),
                        activeInEnvironments: version.activeInEnvironments.map((env) => ({
                            id: env.id,
                            name: env.name,
                        })),
                    })),
                })),
                tags: promptWithRelations.tags.map((tag) => ({
                    id: tag.id,
                    name: tag.name,
                    description: tag.description ?? undefined,
                })),
                executionLogs: options.includeExecutionLogs
                    ? await this.getExecutionLogs(promptId, options.executionLogsLimit || 50)
                    : [],
                statistics,
            };

            // 4. Guardar backup en archivo si está configurado
            let backupPath: string | undefined;
            if (this.shouldSaveToFile()) {
                backupPath = await this.saveBackupToFile(backupData);
            }

            this.logger.log(
                `Backup created successfully for prompt "${promptId}". ` +
                `Backup size: ${JSON.stringify(backupData).length} characters` +
                (backupPath ? `, saved to: ${backupPath}` : ''),
            );

            return { backupData, backupPath };
        } catch (error) {
            this.logger.error(
                `Failed to create backup for prompt "${promptId}": ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    /**
     * Obtiene todos los datos del prompt con sus relaciones
     */
    private async getCompletePromptData(
        promptId: string,
        projectId: string,
        options: PromptBackupOptions,
    ) {
        return this.prisma.prompt.findUnique({
            where: {
                prompt_id_project_unique: {
                    id: promptId,
                    projectId: projectId,
                },
            },
            include: {
                versions: {
                    include: {
                        translations: true,
                        activeInEnvironments: {
                            select: { id: true, name: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                assets: {
                    include: {
                        versions: {
                            include: {
                                translations: true,
                                activeInEnvironments: {
                                    select: { id: true, name: true },
                                },
                            },
                            orderBy: { createdAt: 'desc' },
                        },
                    },
                },
                tags: true,
            },
        });
    }

    /**
     * Genera estadísticas de uso del prompt
     */
    private async generateUsageStatistics(promptId: string) {
        // Contadores básicos
        const [
            totalVersions,
            totalTranslations,
            totalAssets,
            totalAssetVersions,
            totalAssetTranslations,
            totalExecutions,
            lastExecution,
            languageStats,
        ] = await Promise.all([
            this.prisma.promptVersion.count({
                where: { promptId },
            }),
            this.prisma.promptTranslation.count({
                where: { version: { promptId } },
            }),
            this.prisma.promptAsset.count({
                where: { promptId },
            }),
            this.prisma.promptAssetVersion.count({
                where: { asset: { promptId } },
            }),
            this.prisma.assetTranslation.count({
                where: { version: { asset: { promptId } } },
            }),
            this.prisma.promptExecutionLog.count({
                where: { promptVersion: { promptId } },
            }),
            this.prisma.promptExecutionLog.findFirst({
                where: { promptVersion: { promptId } },
                orderBy: { timestamp: 'desc' },
                select: { timestamp: true },
            }),
            this.prisma.promptTranslation.groupBy({
                by: ['languageCode'],
                where: { version: { promptId } },
                _count: { languageCode: true },
                orderBy: { _count: { languageCode: 'desc' } },
                take: 10,
            }),
        ]);

        return {
            totalVersions,
            totalTranslations,
            totalAssets,
            totalAssetVersions,
            totalAssetTranslations,
            totalExecutions,
            lastExecutionDate: lastExecution?.timestamp.toISOString(),
            mostUsedLanguages: languageStats.map((stat) => ({
                languageCode: stat.languageCode,
                count: stat._count.languageCode,
            })),
        };
    }

    /**
 * Obtiene los logs de ejecución más recientes
 */
    private async getExecutionLogs(promptId: string, limit: number) {
        const logs = await this.prisma.promptExecutionLog.findMany({
            where: { promptVersion: { promptId } },
            orderBy: { timestamp: 'desc' },
            take: limit,
            select: {
                id: true,
                timestamp: true,
                promptVersionId: true,
                environmentId: true,
                userId: true,
                input: true,
                output: true,
                success: true,
                durationMs: true,
                errorMessage: true,
            },
        });

        return logs.map((log) => ({
            id: log.id,
            timestamp: log.timestamp.toISOString(),
            promptVersionId: log.promptVersionId,
            environmentId: log.environmentId ?? undefined,
            userId: log.userId ?? undefined,
            input: log.input,
            output: log.output,
            success: log.success,
            durationMs: log.durationMs ?? undefined,
            errorMessage: log.errorMessage ?? undefined,
        }));
    }

    /**
     * Determina si se debe guardar el backup en archivo
     */
    private shouldSaveToFile(): boolean {
        return this.configService.get<boolean>('PROMPT_BACKUP_SAVE_TO_FILE', true);
    }

    /**
     * Guarda el backup en un archivo JSON
     */
    private async saveBackupToFile(backupData: PromptBackupDto): Promise<string> {
        try {
            // Crear directorio si no existe
            await fs.mkdir(this.backupDir, { recursive: true });

            // Generar nombre de archivo único
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `prompt-backup-${backupData.prompt.id}-${timestamp}.json`;
            const filePath = path.join(this.backupDir, fileName);

            // Escribir archivo con formato legible
            await fs.writeFile(
                filePath,
                JSON.stringify(backupData, null, 2),
                'utf8',
            );

            return filePath;
        } catch (error) {
            this.logger.error(
                `Failed to save backup to file: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    /**
     * Lista los backups existentes para un proyecto
     */
    async listBackups(projectId?: string): Promise<Array<{
        fileName: string;
        filePath: string;
        size: number;
        createdAt: Date;
        promptId: string;
        promptName: string;
    }>> {
        try {
            if (!this.shouldSaveToFile()) {
                return [];
            }

            const files = await fs.readdir(this.backupDir);
            const backupFiles = files.filter((file) =>
                file.startsWith('prompt-backup-') && file.endsWith('.json')
            );

            const backupsInfo: Array<{
                fileName: string;
                filePath: string;
                size: number;
                createdAt: Date;
                promptId: string;
                promptName: string;
            }> = [];

            for (const fileName of backupFiles) {
                try {
                    const filePath = path.join(this.backupDir, fileName);
                    const stats = await fs.stat(filePath);

                    // Leer metadatos básicos del archivo
                    const content = await fs.readFile(filePath, 'utf8');
                    const backup: PromptBackupDto = JSON.parse(content);

                    // Filtrar por proyecto si se especifica
                    if (projectId && backup.prompt.projectId !== projectId) {
                        continue;
                    }

                    backupsInfo.push({
                        fileName,
                        filePath,
                        size: stats.size,
                        createdAt: stats.mtime,
                        promptId: backup.prompt.id,
                        promptName: backup.prompt.name,
                    });
                } catch (error) {
                    this.logger.warn(`Error reading backup file ${fileName}: ${error.message}`);
                }
            }

            return backupsInfo.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } catch (error) {
            this.logger.error(`Failed to list backups: ${error.message}`);
            return [];
        }
    }

    /**
     * Restaura un prompt desde un backup (funcionalidad futura)
     */
    async restoreFromBackup(backupPath: string): Promise<void> {
        // TODO: Implementar funcionalidad de restauración
        this.logger.warn('Restore functionality not yet implemented');
        throw new Error('Restore functionality not yet implemented');
    }
} 