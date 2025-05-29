import { ApiProperty } from '@nestjs/swagger';
import { ActivityActionEnum, ActivityEntityTypeEnum } from '../types/activity.types';

export class RecentActivityDto {
    @ApiProperty({
        description: 'ID único de la actividad',
        example: 'clg123xyz',
    })
    id: string;

    @ApiProperty({
        description: 'Timestamp de cuando ocurrió la actividad',
        example: '2024-03-20T15:30:00Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'Tipo de acción realizada',
        enum: ActivityActionEnum,
        example: ActivityActionEnum.CREATE,
    })
    action: ActivityActionEnum;

    @ApiProperty({
        description: 'Tipo de entidad afectada',
        enum: ActivityEntityTypeEnum,
        example: ActivityEntityTypeEnum.PROMPT,
    })
    entityType: ActivityEntityTypeEnum;

    @ApiProperty({
        description: 'ID de la entidad afectada',
        example: 'prompt-123',
    })
    entityId: string;

    @ApiProperty({
        description: 'ID del usuario que realizó la acción',
        example: 'user-456',
    })
    userId: string;

    @ApiProperty({
        description: 'Nombre del usuario que realizó la acción',
        example: 'John Doe',
    })
    userName: string;

    @ApiProperty({
        description: 'ID del proyecto relacionado',
        example: 'project-789',
    })
    projectId: string;

    @ApiProperty({
        description: 'Nombre del proyecto relacionado',
        example: 'Mi Proyecto',
    })
    projectName: string;

    @ApiProperty({
        description: 'Detalles adicionales de la actividad',
        example: { version: '1.0.0', languageCode: 'es-ES' },
        required: false,
    })
    details?: Record<string, any>;

    @ApiProperty({
        description: 'Cambios realizados en la entidad',
        example: { oldValue: 'valor anterior', newValue: 'valor nuevo' },
        required: false,
    })
    changes?: {
        old?: any;
        new?: any;
    };
} 