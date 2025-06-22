import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export const ActivityAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  PUBLISH: 'PUBLISH',
  UNPUBLISH: 'UNPUBLISH',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const;

export const ActivityEntityType = {
  PROMPT: 'PROMPT',
  PROMPT_VERSION: 'PROMPT_VERSION',
  PROMPT_TRANSLATION: 'PROMPT_TRANSLATION',
  PROMPT_ASSET: 'PROMPT_ASSET',
  PROMPT_ASSET_VERSION: 'PROMPT_ASSET_VERSION',
  ASSET_TRANSLATION: 'ASSET_TRANSLATION',
  PROJECT: 'PROJECT',
  ENVIRONMENT: 'ENVIRONMENT',
  AI_MODEL: 'AI_MODEL',
  TAG: 'TAG',
  REGION: 'REGION',
  CULTURAL_DATA: 'CULTURAL_DATA',
  RAG_DOCUMENT: 'RAG_DOCUMENT',
} as const;

export type ActivityActionType = typeof ActivityAction[keyof typeof ActivityAction];
export type ActivityEntityTypeType = typeof ActivityEntityType[keyof typeof ActivityEntityType];

export interface ActivityLogData {
  action: ActivityActionType;
  entityType: ActivityEntityTypeType;
  entityId: string;
  userId: string;
  projectId: string;
  details?: any;
  changes?: {
    old?: any;
    new?: any;
  };
}

interface ActivityLogFilters {
  projectId?: string;
  userId?: string;
  entityType?: ActivityEntityTypeType;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ActivityLogWithUser {
  id: string;
  timestamp: Date;
  action: ActivityActionType;
  entityType: ActivityEntityTypeType;
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
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private prisma: PrismaService) { }

  async logActivity(data: ActivityLogData): Promise<void> {
    const {
      action,
      entityType,
      entityId,
      userId,
      projectId,
      details,
      changes,
    } = data;

    try {
      const result = await this.prisma.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          action,
          entityType,
          entityId,
          userId,
          projectId,
          details: details ? JSON.stringify(details) : null,
          changes: changes ? JSON.stringify(changes) : null,
        },
      });

      this.logger.debug(`audit ok: ${result.id}`);
    } catch (error) {
      this.logger.error(`audit error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getActivityLogs(
    filters: ActivityLogFilters = {},
  ): Promise<PaginatedResponse<ActivityLogWithUser>> {
    const {
      projectId,
      userId,
      entityType,
      entityId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = {};

    if (projectId) where.projectId = projectId;
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [total, logs] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: logs as ActivityLogWithUser[],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEntityActivity(
    entityType: ActivityEntityTypeType,
    entityId: string,
    projectId: string,
  ) {
    return this.getActivityLogs({
      entityType,
      entityId,
      projectId,
    });
  }
}
