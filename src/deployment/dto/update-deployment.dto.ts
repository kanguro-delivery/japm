import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { DeploymentStatus } from '@prisma/client';

export class UpdateDeploymentDto {
    @ApiPropertyOptional({
        description: 'Nuevo nombre del deployment',
        example: 'deploy-feature-multilang-2024-01-15-v2'
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({
        description: 'Nueva descripción del deployment',
        example: 'Deployment actualizado de la nueva funcionalidad de soporte multiidioma'
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({
        description: 'Nuevo estado del deployment',
        enum: DeploymentStatus
    })
    @IsOptional()
    @IsEnum(DeploymentStatus)
    status?: DeploymentStatus;
} 