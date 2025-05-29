import {
    Controller,
    Get,
    Query,
    UseGuards,
    Logger,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { RecentActivityDto } from './dto/recent-activity.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActivityActionEnum, ActivityEntityTypeEnum } from './types/activity.types';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
    private readonly logger = new Logger(DashboardController.name);

    constructor(private readonly dashboardService: DashboardService) { }

    @Get('stats')
    @ApiOperation({ summary: 'Obtener estadísticas del dashboard' })
    @ApiResponse({
        status: 200,
        description: 'Estadísticas obtenidas exitosamente',
        type: DashboardStatsDto,
    })
    @ApiQuery({ name: 'projectId', required: false, type: String })
    async getStats(
        @GetUser('tenantId') tenantId: string,
        @Query('projectId') projectId?: string
    ): Promise<DashboardStatsDto> {
        this.logger.debug(`Obteniendo estadísticas para tenant: ${tenantId}${projectId ? ` y proyecto: ${projectId}` : ''}`);
        return this.dashboardService.getStats(tenantId, projectId);
    }

    @Get('recent-activity')
    @ApiOperation({ summary: 'Obtener actividad reciente' })
    @ApiResponse({
        status: 200,
        description: 'Actividad reciente obtenida exitosamente',
        type: [RecentActivityDto],
    })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiQuery({ name: 'userId', required: false, type: String })
    @ApiQuery({ name: 'projectId', required: false, type: String })
    @ApiQuery({ name: 'entityType', required: false, enum: ActivityEntityTypeEnum })
    @ApiQuery({ name: 'action', required: false, enum: ActivityActionEnum })
    async getRecentActivity(
        @GetUser('tenantId') tenantId: string,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
        @Query('userId') userId?: string,
        @Query('projectId') projectId?: string,
        @Query('entityType') entityType?: ActivityEntityTypeEnum,
        @Query('action') action?: ActivityActionEnum,
    ): Promise<RecentActivityDto[]> {
        // Filtrar parámetros vacíos
        const filters = {
            limit,
            offset,
            userId: userId || undefined,
            projectId: projectId || undefined,
            entityType: entityType || undefined,
            action: action || undefined,
        };

        this.logger.debug(
            `Obteniendo actividad reciente para tenant: ${tenantId} con filtros:`,
            filters,
        );
        return this.dashboardService.getRecentActivity(tenantId, filters);
    }

    @Get('activity')
    @ApiOperation({ summary: 'Obtener actividad reciente' })
    @ApiResponse({
        status: 200,
        description: 'Actividad obtenida exitosamente',
        type: [RecentActivityDto],
    })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiQuery({ name: 'userId', required: false, type: String })
    @ApiQuery({ name: 'projectId', required: false, type: String })
    @ApiQuery({ name: 'entityType', required: false, enum: ActivityEntityTypeEnum })
    @ApiQuery({ name: 'action', required: false, enum: ActivityActionEnum })
    async getActivity(
        @GetUser('tenantId') tenantId: string,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
        @Query('userId') userId?: string,
        @Query('projectId') projectId?: string,
        @Query('entityType') entityType?: ActivityEntityTypeEnum,
        @Query('action') action?: ActivityActionEnum,
    ): Promise<RecentActivityDto[]> {
        this.logger.log(`Obteniendo actividad con filtros: ${JSON.stringify({ limit, offset, userId, projectId, entityType, action })}`);
        return this.dashboardService.getRecentActivity(tenantId, {
            limit,
            offset,
            userId,
            projectId,
            entityType,
            action,
        });
    }
} 