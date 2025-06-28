import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeploymentDto, UpdateDeploymentDto, DeploymentResponseDto } from './dto';
import { DeploymentStatus, DeploymentItemStatus, DeploymentEntityType, Role } from '@prisma/client';
import { AuditLoggerService } from '../common/services/audit-logger.service';

@Injectable()
export class DeploymentService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogger: AuditLoggerService,
    ) { }

    async createDeployment(
        projectId: string,
        createDeploymentDto: CreateDeploymentDto,
        userId: string,
    ): Promise<DeploymentResponseDto> {
        // Verificar que el proyecto existe y el usuario tiene acceso
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { owner: true },
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${projectId} not found`);
        }

        // Verificar que el entorno existe y pertenece al proyecto
        const environment = await this.prisma.environment.findFirst({
            where: {
                id: createDeploymentDto.environmentId,
                projectId: projectId,
            },
        });

        if (!environment) {
            throw new NotFoundException(`Environment with ID ${createDeploymentDto.environmentId} not found in project ${projectId}`);
        }

        // Validar que los items existen y son válidos
        await this.validateDeploymentItems(createDeploymentDto.items);

        // Crear el deployment
        const deployment = await this.prisma.deployment.create({
            data: {
                name: createDeploymentDto.name,
                description: createDeploymentDto.description,
                environmentId: createDeploymentDto.environmentId,
                requestedById: userId,
                projectId: projectId,
                status: DeploymentStatus.PENDING,
                deploymentItems: {
                    create: createDeploymentDto.items.map((item) => ({
                        entityType: item.entityType,
                        entityId: item.entityId,
                        versionTag: item.versionTag,
                        changeMessage: item.changeMessage,
                        riskLevel: item.riskLevel || 'LOW',
                        status: DeploymentItemStatus.PENDING,
                        // Asignar las referencias específicas según el tipo
                        ...(item.entityType === 'PROMPT_VERSION' && {
                            promptVersionId: item.entityId,
                        }),
                        ...(item.entityType === 'PROMPT_ASSET_VERSION' && {
                            promptAssetVersionId: item.entityId,
                        }),
                        ...(item.entityType === 'AI_MODEL' && {
                            aiModelId: item.entityId,
                        }),
                    })),
                },
            },
            include: {
                environment: true,
                requestedBy: true,
                approvedBy: true,
                deploymentItems: {
                    include: {
                        promptVersion: true,
                        promptAssetVersion: true,
                        aiModel: true,
                    },
                },
            },
        });

        // Log de auditoría
        await this.auditLogger.logDeploymentCreated({
            deploymentId: deployment.id,
            projectId,
            environmentId: deployment.environmentId,
            requestedBy: userId,
            itemsCount: deployment.deploymentItems.length,
        });

        return this.mapToResponseDto(deployment);
    }

    async findAllDeployments(
        projectId: string,
        environmentId?: string,
        status?: DeploymentStatus,
    ): Promise<DeploymentResponseDto[]> {
        const where: any = { projectId };

        if (environmentId) {
            where.environmentId = environmentId;
        }

        if (status) {
            where.status = status;
        }

        const deployments = await this.prisma.deployment.findMany({
            where,
            include: {
                environment: true,
                requestedBy: true,
                approvedBy: true,
                deploymentItems: {
                    include: {
                        promptVersion: true,
                        promptAssetVersion: true,
                        aiModel: true,
                    },
                },
            },
            orderBy: { requestedAt: 'desc' },
        });

        return deployments.map((deployment) => this.mapToResponseDto(deployment));
    }

    async findDeploymentById(
        projectId: string,
        deploymentId: string,
    ): Promise<DeploymentResponseDto> {
        const deployment = await this.prisma.deployment.findFirst({
            where: {
                id: deploymentId,
                projectId: projectId,
            },
            include: {
                environment: true,
                requestedBy: true,
                approvedBy: true,
                deploymentItems: {
                    include: {
                        promptVersion: true,
                        promptAssetVersion: true,
                        aiModel: true,
                    },
                },
            },
        });

        if (!deployment) {
            throw new NotFoundException(`Deployment with ID ${deploymentId} not found in project ${projectId}`);
        }

        return this.mapToResponseDto(deployment);
    }

    async approveDeployment(
        projectId: string,
        deploymentId: string,
        userId: string,
    ): Promise<DeploymentResponseDto> {
        const deployment = await this.prisma.deployment.findFirst({
            where: {
                id: deploymentId,
                projectId: projectId,
            },
            include: {
                requestedBy: true,
            },
        });

        if (!deployment) {
            throw new NotFoundException(`Deployment with ID ${deploymentId} not found in project ${projectId}`);
        }

        if (deployment.status !== DeploymentStatus.PENDING) {
            throw new BadRequestException(`Deployment is not in PENDING status. Current status: ${deployment.status}`);
        }

        // Verificar que el usuario no está aprobando su propio deployment
        if (deployment.requestedById === userId) {
            throw new ForbiddenException('Cannot approve your own deployment');
        }

        const updatedDeployment = await this.prisma.deployment.update({
            where: { id: deploymentId },
            data: {
                status: DeploymentStatus.APPROVED,
                approvedById: userId,
                approvedAt: new Date(),
            },
            include: {
                environment: true,
                requestedBy: true,
                approvedBy: true,
                deploymentItems: {
                    include: {
                        promptVersion: true,
                        promptAssetVersion: true,
                        aiModel: true,
                    },
                },
            },
        });

        // Log de auditoría
        await this.auditLogger.logDeploymentApproved({
            deploymentId: deployment.id,
            projectId,
            approvedBy: userId,
            requestedBy: deployment.requestedById,
        });

        return this.mapToResponseDto(updatedDeployment);
    }

    async deployDeployment(
        projectId: string,
        deploymentId: string,
        userId: string,
    ): Promise<DeploymentResponseDto> {
        const deployment = await this.prisma.deployment.findFirst({
            where: {
                id: deploymentId,
                projectId: projectId,
            },
            include: {
                deploymentItems: true,
                environment: true,
            },
        });

        if (!deployment) {
            throw new NotFoundException(`Deployment with ID ${deploymentId} not found in project ${projectId}`);
        }

        if (deployment.status !== DeploymentStatus.APPROVED) {
            throw new BadRequestException(`Deployment must be APPROVED to deploy. Current status: ${deployment.status}`);
        }

        // Iniciar transacción para el deployment
        const result = await this.prisma.$transaction(async (tx) => {
            // Actualizar estado del deployment
            const updatedDeployment = await tx.deployment.update({
                where: { id: deploymentId },
                data: {
                    status: DeploymentStatus.DEPLOYING,
                },
                include: {
                    environment: true,
                    requestedBy: true,
                    approvedBy: true,
                    deploymentItems: {
                        include: {
                            promptVersion: true,
                            promptAssetVersion: true,
                            aiModel: true,
                        },
                    },
                },
            });

            // Procesar cada item del deployment
            for (const item of deployment.deploymentItems) {
                try {
                    await this.deployItem(tx, item, deployment.environmentId);

                    // Actualizar estado del item
                    await tx.deploymentItem.update({
                        where: { id: item.id },
                        data: {
                            status: DeploymentItemStatus.DEPLOYED,
                            deployedAt: new Date(),
                        },
                    });
                } catch (error) {
                    // Marcar item como fallido
                    await tx.deploymentItem.update({
                        where: { id: item.id },
                        data: {
                            status: DeploymentItemStatus.FAILED,
                            errorMessage: error.message,
                        },
                    });

                    throw error;
                }
            }

            // Marcar deployment como completado
            return await tx.deployment.update({
                where: { id: deploymentId },
                data: {
                    status: DeploymentStatus.DEPLOYED,
                    deployedAt: new Date(),
                },
                include: {
                    environment: true,
                    requestedBy: true,
                    approvedBy: true,
                    deploymentItems: {
                        include: {
                            promptVersion: true,
                            promptAssetVersion: true,
                            aiModel: true,
                        },
                    },
                },
            });
        });

        // Log de auditoría
        await this.auditLogger.logDeploymentDeployed({
            deploymentId: deployment.id,
            projectId,
            deployedBy: userId,
            itemsCount: deployment.deploymentItems.length,
        });

        return this.mapToResponseDto(result);
    }

    async rollbackDeployment(
        projectId: string,
        deploymentId: string,
        rollbackToDeploymentId: string,
        userId: string,
    ): Promise<DeploymentResponseDto> {
        const deployment = await this.prisma.deployment.findFirst({
            where: {
                id: deploymentId,
                projectId: projectId,
            },
        });

        if (!deployment) {
            throw new NotFoundException(`Deployment with ID ${deploymentId} not found in project ${projectId}`);
        }

        const rollbackToDeployment = await this.prisma.deployment.findFirst({
            where: {
                id: rollbackToDeploymentId,
                projectId: projectId,
                environmentId: deployment.environmentId,
            },
        });

        if (!rollbackToDeployment) {
            throw new NotFoundException(`Rollback deployment with ID ${rollbackToDeploymentId} not found`);
        }

        const updatedDeployment = await this.prisma.deployment.update({
            where: { id: deploymentId },
            data: {
                status: DeploymentStatus.ROLLED_BACK,
                rolledBackAt: new Date(),
                rollbackToDeploymentId: rollbackToDeploymentId,
            },
            include: {
                environment: true,
                requestedBy: true,
                approvedBy: true,
                deploymentItems: {
                    include: {
                        promptVersion: true,
                        promptAssetVersion: true,
                        aiModel: true,
                    },
                },
            },
        });

        // Log de auditoría
        await this.auditLogger.logDeploymentRolledBack({
            deploymentId: deployment.id,
            projectId,
            rolledBackBy: userId,
            rollbackToDeploymentId: rollbackToDeploymentId,
        });

        return this.mapToResponseDto(updatedDeployment);
    }

    private async validateDeploymentItems(items: any[]): Promise<void> {
        for (const item of items) {
            switch (item.entityType) {
                case 'PROMPT_VERSION':
                    const promptVersion = await this.prisma.promptVersion.findUnique({
                        where: { id: item.entityId },
                    });
                    if (!promptVersion) {
                        throw new BadRequestException(`PromptVersion with ID ${item.entityId} not found`);
                    }
                    if (promptVersion.versionTag !== item.versionTag) {
                        throw new BadRequestException(`Version tag mismatch for PromptVersion ${item.entityId}`);
                    }
                    break;

                case 'PROMPT_ASSET_VERSION':
                    const assetVersion = await this.prisma.promptAssetVersion.findUnique({
                        where: { id: item.entityId },
                    });
                    if (!assetVersion) {
                        throw new BadRequestException(`PromptAssetVersion with ID ${item.entityId} not found`);
                    }
                    if (assetVersion.versionTag !== item.versionTag) {
                        throw new BadRequestException(`Version tag mismatch for PromptAssetVersion ${item.entityId}`);
                    }
                    break;

                case 'AI_MODEL':
                    const aiModel = await this.prisma.aIModel.findUnique({
                        where: { id: item.entityId },
                    });
                    if (!aiModel) {
                        throw new BadRequestException(`AIModel with ID ${item.entityId} not found`);
                    }
                    break;

                default:
                    throw new BadRequestException(`Invalid entity type: ${item.entityType}`);
            }
        }
    }

    private async deployItem(tx: any, item: any, environmentId: string): Promise<void> {
        switch (item.entityType) {
            case 'PROMPT_VERSION':
                // Activar la versión del prompt en el entorno
                await tx.environment.update({
                    where: { id: environmentId },
                    data: {
                        activePromptVersions: {
                            connect: { id: item.entityId },
                        },
                    },
                });
                break;

            case 'PROMPT_ASSET_VERSION':
                // Activar la versión del asset en el entorno
                await tx.environment.update({
                    where: { id: environmentId },
                    data: {
                        activeAssetVersions: {
                            connect: { id: item.entityId },
                        },
                    },
                });
                break;

            case 'AI_MODEL':
                // Los AI Models no necesitan activación específica por entorno
                // Solo se registra que se está usando
                break;

            default:
                throw new Error(`Unknown entity type: ${item.entityType}`);
        }
    }

    private mapToResponseDto(deployment: any): DeploymentResponseDto {
        return {
            id: deployment.id,
            name: deployment.name,
            description: deployment.description,
            status: deployment.status,
            environmentId: deployment.environmentId,
            environmentName: deployment.environment.name,
            requestedById: deployment.requestedById,
            requestedByName: deployment.requestedBy.name,
            approvedById: deployment.approvedById,
            approvedByName: deployment.approvedBy?.name,
            requestedAt: deployment.requestedAt,
            approvedAt: deployment.approvedAt,
            deployedAt: deployment.deployedAt,
            rolledBackAt: deployment.rolledBackAt,
            rollbackToDeploymentId: deployment.rollbackToDeploymentId,
            items: deployment.deploymentItems.map((item: any) => ({
                id: item.id,
                entityType: item.entityType,
                entityId: item.entityId,
                versionTag: item.versionTag,
                status: item.status,
                errorMessage: item.errorMessage,
                changeMessage: item.changeMessage,
                riskLevel: item.riskLevel,
                deployedAt: item.deployedAt,
            })),
        };
    }
} 