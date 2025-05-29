import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { RecentActivityDto } from './dto/recent-activity.dto';
import { ActivityActionEnum, ActivityEntityTypeEnum } from './types/activity.types';
import { AuditLoggerService, AuditResult, AuditAction } from '../common/services/audit-logger.service';
import { ActivityLogService } from '../services/activityLogService';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        private prisma: PrismaService,
        private auditLogger: AuditLoggerService,
        private activityLogService: ActivityLogService,
    ) { }

    async getStats(tenantId: string, projectId?: string): Promise<DashboardStatsDto> {
        try {
            const [
                activeProjects,
                executedPrompts,
                activeModels,
                activeUsers,
                activeAssets,
                activePrompts,
                configuredRegions,
                culturalDataEntries,
            ] = await Promise.all([
                // Proyectos activos
                this.prisma.project.count({
                    where: { tenantId },
                }),

                // Prompts ejecutados
                this.prisma.promptExecutionLog.count({
                    where: {
                        project: {
                            tenantId,
                            ...(projectId ? { id: projectId } : {})
                        },
                    },
                }),

                // Modelos de IA activos
                this.prisma.aIModel.count({
                    where: {
                        project: {
                            tenantId,
                            ...(projectId ? { id: projectId } : {})
                        },
                    },
                }),

                // Usuarios activos (últimos 30 días)
                this.prisma.user.count({
                    where: {
                        tenantId,
                        updatedAt: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                }),

                // Assets activos
                this.prisma.promptAsset.count({
                    where: {
                        prompt: {
                            project: {
                                tenantId,
                                ...(projectId ? { id: projectId } : {})
                            },
                        },
                        enabled: true,
                    },
                }),

                // Prompts activos
                this.prisma.prompt.count({
                    where: {
                        project: {
                            tenantId,
                            ...(projectId ? { id: projectId } : {})
                        },
                    },
                }),

                // Regiones configuradas
                this.prisma.region.count({
                    where: {
                        project: {
                            tenantId,
                            ...(projectId ? { id: projectId } : {})
                        },
                    },
                }),

                // Datos culturales
                this.prisma.culturalData.count({
                    where: {
                        project: {
                            tenantId,
                            ...(projectId ? { id: projectId } : {})
                        },
                    },
                }),
            ]);

            await this.auditLogger.logAuditEvent(
                {
                    tenantId,
                    operation: 'VIEW_DASHBOARD_STATS',
                    resourceType: 'Dashboard',
                },
                {
                    action: AuditAction.VIEW,
                    resourceType: 'Dashboard',
                    resourceId: 'stats',
                    result: AuditResult.SUCCESS,
                    details: {
                        tenantId,
                        projectId,
                        stats: {
                            activeProjects,
                            executedPrompts,
                            activeModels,
                            activeUsers,
                            activeAssets,
                            activePrompts,
                            configuredRegions,
                            culturalDataEntries,
                        },
                    },
                },
            );

            return {
                activeProjects,
                executedPrompts,
                activeModels,
                activeUsers,
                activeAssets,
                activePrompts,
                configuredRegions,
                culturalDataEntries,
            };
        } catch (error) {
            this.logger.error('Error al obtener estadísticas del dashboard:', error);
            throw error;
        }
    }

    async getRecentActivity(
        tenantId: string,
        options: {
            limit?: number;
            offset?: number;
            userId?: string;
            projectId?: string;
            entityType?: ActivityEntityTypeEnum;
            action?: ActivityActionEnum;
        } = {},
    ): Promise<RecentActivityDto[]> {
        try {
            const { limit = 10, offset = 0, userId, projectId, entityType, action } = options;

            // Construir filtros solo con los parámetros que tienen valor
            const filters: any = {};
            if (userId) filters.userId = userId;
            if (projectId) filters.projectId = projectId;
            if (entityType) filters.entityType = entityType;
            if (action) filters.action = action;

            const result = await this.activityLogService.getActivityLogs({
                ...filters,
                page: Math.floor(offset / limit) + 1,
                limit,
            });

            await this.auditLogger.logAuditEvent(
                {
                    tenantId,
                    operation: 'VIEW_DASHBOARD_ACTIVITY',
                    resourceType: 'Dashboard',
                },
                {
                    action: AuditAction.VIEW,
                    resourceType: 'Dashboard',
                    resourceId: 'activity',
                    result: AuditResult.SUCCESS,
                    details: {
                        tenantId,
                        options,
                        count: result.data.length,
                    },
                },
            );

            return result.data.map((activity) => ({
                id: activity.id,
                timestamp: activity.timestamp,
                action: activity.action as ActivityActionEnum,
                entityType: activity.entityType as ActivityEntityTypeEnum,
                entityId: activity.entityId,
                userId: activity.userId,
                userName: activity.user.name,
                projectId: activity.projectId,
                projectName: '',
                details: activity.details ? JSON.parse(activity.details) : undefined,
                changes: activity.changes ? JSON.parse(activity.changes) : undefined,
            }));
        } catch (error) {
            this.logger.error('Error al obtener actividad reciente:', error);
            throw error;
        }
    }
} 