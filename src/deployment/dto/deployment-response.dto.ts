import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeploymentStatus, DeploymentItemStatus, DeploymentEntityType, RiskLevel } from '@prisma/client';

export class DeploymentItemResponseDto {
    @ApiProperty({
        description: 'ID del item de deployment',
        example: 'clx1234567890abcdef'
    })
    id: string;

    @ApiProperty({
        description: 'Tipo de entidad',
        enum: DeploymentEntityType
    })
    entityType: DeploymentEntityType;

    @ApiProperty({
        description: 'ID de la entidad',
        example: 'clx1234567890abcdef'
    })
    entityId: string;

    @ApiProperty({
        description: 'Tag de la versión',
        example: '1.2.0'
    })
    versionTag: string;

    @ApiProperty({
        description: 'Estado del item',
        enum: DeploymentItemStatus
    })
    status: DeploymentItemStatus;

    @ApiPropertyOptional({
        description: 'Mensaje de error si falló',
        example: 'Error al desplegar la versión'
    })
    errorMessage?: string;

    @ApiPropertyOptional({
        description: 'Mensaje de cambio',
        example: 'Mejora en la validación de entrada'
    })
    changeMessage?: string;

    @ApiProperty({
        description: 'Nivel de riesgo',
        enum: RiskLevel
    })
    riskLevel: RiskLevel;

    @ApiPropertyOptional({
        description: 'Fecha de despliegue',
        example: '2024-01-15T10:30:00Z'
    })
    deployedAt?: Date;
}

export class DeploymentResponseDto {
    @ApiProperty({
        description: 'ID del deployment',
        example: 'clx1234567890abcdef'
    })
    id: string;

    @ApiProperty({
        description: 'Nombre del deployment',
        example: 'deploy-feature-multilang-2024-01-15'
    })
    name: string;

    @ApiPropertyOptional({
        description: 'Descripción del deployment',
        example: 'Deployment de la nueva funcionalidad de soporte multiidioma'
    })
    description?: string;

    @ApiProperty({
        description: 'Estado del deployment',
        enum: DeploymentStatus
    })
    status: DeploymentStatus;

    @ApiProperty({
        description: 'ID del entorno',
        example: 'clx1234567890abcdef'
    })
    environmentId: string;

    @ApiProperty({
        description: 'Nombre del entorno',
        example: 'production'
    })
    environmentName: string;

    @ApiProperty({
        description: 'ID del usuario que solicitó el deployment',
        example: 'clx1234567890abcdef'
    })
    requestedById: string;

    @ApiProperty({
        description: 'Nombre del usuario que solicitó el deployment',
        example: 'Juan Pérez'
    })
    requestedByName: string;

    @ApiPropertyOptional({
        description: 'ID del usuario que aprobó el deployment',
        example: 'clx1234567890abcdef'
    })
    approvedById?: string;

    @ApiPropertyOptional({
        description: 'Nombre del usuario que aprobó el deployment',
        example: 'María García'
    })
    approvedByName?: string;

    @ApiProperty({
        description: 'Fecha de solicitud',
        example: '2024-01-15T09:00:00Z'
    })
    requestedAt: Date;

    @ApiPropertyOptional({
        description: 'Fecha de aprobación',
        example: '2024-01-15T09:30:00Z'
    })
    approvedAt?: Date;

    @ApiPropertyOptional({
        description: 'Fecha de despliegue',
        example: '2024-01-15T10:00:00Z'
    })
    deployedAt?: Date;

    @ApiPropertyOptional({
        description: 'Fecha de rollback',
        example: '2024-01-15T11:00:00Z'
    })
    rolledBackAt?: Date;

    @ApiProperty({
        description: 'Items del deployment',
        type: [DeploymentItemResponseDto]
    })
    items: DeploymentItemResponseDto[];

    @ApiPropertyOptional({
        description: 'ID del deployment de rollback',
        example: 'clx1234567890abcdef'
    })
    rollbackToDeploymentId?: string;
} 