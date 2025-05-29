import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsDto {
    @ApiProperty({
        description: 'Número de proyectos activos',
        example: 5,
    })
    activeProjects: number;

    @ApiProperty({
        description: 'Número total de prompts ejecutados',
        example: 150,
    })
    executedPrompts: number;

    @ApiProperty({
        description: 'Número de modelos de IA activos',
        example: 3,
    })
    activeModels: number;

    @ApiProperty({
        description: 'Número de usuarios activos',
        example: 10,
    })
    activeUsers: number;

    @ApiProperty({
        description: 'Número de assets activos',
        example: 25,
    })
    activeAssets: number;

    @ApiProperty({
        description: 'Número de prompts activos',
        example: 50,
    })
    activePrompts: number;

    @ApiProperty({
        description: 'Número de regiones configuradas',
        example: 8,
    })
    configuredRegions: number;

    @ApiProperty({
        description: 'Número de datos culturales registrados',
        example: 15,
    })
    culturalDataEntries: number;
} 