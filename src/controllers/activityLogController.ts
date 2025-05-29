import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from '../services/activityLogService';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivityEntityType } from '@prisma/client';

interface ActivityLogResponse {
  data: {
    id: string;
    timestamp: Date;
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    projectId: string;
    details: string | null;
    changes: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Controller('activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) { }

  @Get()
  async getActivityLogs(
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('entityType') entityType?: ActivityEntityType,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ActivityLogResponse> {
    const result = await this.activityLogService.getActivityLogs({
      projectId,
      userId,
      entityType,
      entityId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return result;
  }

  @Get('entity/:entityType/:entityId')
  async getEntityActivity(
    @Query('projectId') projectId: string,
    @Query('entityType') entityType: ActivityEntityType,
    @Query('entityId') entityId: string,
  ): Promise<ActivityLogResponse> {
    const result = await this.activityLogService.getEntityActivity(
      entityType,
      entityId,
      projectId,
    );

    return result;
  }
}
