import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DeploymentEntityType, RiskLevel } from '@prisma/client';

export class CreateDeploymentItemDto {
    @ApiProperty({
        description: 'Tipo de entidad a desplegar',
        enum: DeploymentEntityType,
        example: 'PROMPT_VERSION'
    })
    @IsEnum(DeploymentEntityType)
    entityType: DeploymentEntityType;

    @ApiProperty({
        description: 'ID de la entidad a desplegar',
        example: 'clx1234567890abcdef'
    })
    @IsString()
    entityId: string;

    @ApiProperty({
        description: 'Tag de la versión a desplegar',
        example: '1.2.0'
    })
    @IsString()
    versionTag: string;

    @ApiPropertyOptional({
        description: 'Mensaje de cambio para este item',
        example: 'Mejora en la validación de entrada'
    })
    @IsOptional()
    @IsString()
    changeMessage?: string;

    @ApiPropertyOptional({
        description: 'Nivel de riesgo del cambio',
        enum: RiskLevel,
        default: 'LOW'
    })
    @IsOptional()
    @IsEnum(RiskLevel)
    riskLevel?: RiskLevel = 'LOW';
}

export class CreateDeploymentDto {
    @ApiProperty({
        description: 'Nombre del deployment',
        example: 'deploy-feature-multilang-2024-01-15'
    })
    @IsString()
    name: string;

    @ApiPropertyOptional({
        description: 'Descripción del deployment',
        example: 'Deployment de la nueva funcionalidad de soporte multiidioma'
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'ID del entorno donde se desplegará',
        example: 'clx1234567890abcdef'
    })
    @IsString()
    environmentId: string;

    @ApiProperty({
        description: 'Items a desplegar',
        type: [CreateDeploymentItemDto]
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDeploymentItemDto)
    items: CreateDeploymentItemDto[];
} 