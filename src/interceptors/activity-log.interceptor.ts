import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
    ActivityLogService,
    ActivityEntityType,
    ActivityAction,
} from '../services/activityLogService';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthenticatedRequest, AuthenticatedUser } from '../common/types/request.types';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(ActivityLogInterceptor.name);

    constructor(
        private readonly activityLogService: ActivityLogService,
        private readonly jwtService: JwtService,
    ) { }

    private getEntityTypeFromPath(
        path: string,
    ): typeof ActivityEntityType[keyof typeof ActivityEntityType] | null {
        // Normalize path to ensure consistent comparisons
        const normalizedPath = path.toLowerCase();

        if (normalizedPath.includes('/prompts/')) return ActivityEntityType.PROMPT;
        if (normalizedPath.includes('/prompt-versions/')) return ActivityEntityType.PROMPT_VERSION;
        if (normalizedPath.includes('/prompt-assets/')) return ActivityEntityType.PROMPT_ASSET;
        if (normalizedPath.includes('/aimodels/')) return ActivityEntityType.AI_MODEL;
        if (normalizedPath.includes('/projects/')) return ActivityEntityType.PROJECT;
        if (normalizedPath.includes('/environments/')) return ActivityEntityType.ENVIRONMENT;
        if (normalizedPath.includes('/tags/')) return ActivityEntityType.TAG;
        if (normalizedPath.includes('/regions/')) return ActivityEntityType.REGION;
        if (normalizedPath.includes('/cultural-data/')) return ActivityEntityType.CULTURAL_DATA;
        if (normalizedPath.includes('/rag-documents/')) return ActivityEntityType.RAG_DOCUMENT;

        this.logger.debug(`No entityType found for path: ${normalizedPath}`);
        return null;
    }

    private getActionFromMethod(
        method: string,
    ): typeof ActivityAction[keyof typeof ActivityAction] | null {
        switch (method) {
            case 'POST':
                return ActivityAction.CREATE;
            case 'PUT':
            case 'PATCH':
                return ActivityAction.UPDATE;
            case 'DELETE':
                return ActivityAction.DELETE;
            default:
                //this.logger.debug(`No action found for method: ${method}`);
                return null;
        }
    }

    private getProjectId(request: Request): string | null {
        const projectId =
            request.body?.projectId ||
            request.params?.projectId ||
            request.query?.projectId ||
            request.headers['x-project-id'];

        return projectId as string | null;
    }

    private getUserId(request: AuthenticatedRequest): string | null {
        // First try to get ID from user object
        if (request.user?.id) {
            return request.user.id;
        }

        // If not in user object, try to get it from JWT token
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = this.jwtService.decode(token);
                if (decoded && typeof decoded === 'object' && 'sub' in decoded) {
                    return decoded.sub as string;
                }
            } catch (error) {
                this.logger.warn(`Error decoding JWT token: ${error.message}`);
            }
        }

        return null;
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const { method, path, body, params, user } = request;
        const entityType = this.getEntityTypeFromPath(path);
        const action = this.getActionFromMethod(method);

        if (!entityType || !action) {
            /*
            this.logger.debug('Activity will not be logged: entityType or action not found', {
                path,
                method,
                entityType,
                action,
            });
            */
            return next.handle();
        }

        const userId = this.getUserId(request);
        const projectId = this.getProjectId(request);

        if (!userId || !projectId) {
            this.logger.warn('Could not log activity: missing userId or projectId', {
                userId,
                projectId,
                path,
                method,
                user: user ? { id: user.id, email: user.email } : null,
                headers: request.headers,
                body: request.body,
                params: request.params,
                query: request.query,
            });
            return next.handle();
        }

        return next.handle().pipe(
            tap({
                next: async (response) => {
                    try {
                        const entityId = response?.id || params?.aiModelId || params?.id;
                        if (!entityId) {
                            this.logger.warn('Could not get entityId from response', {
                                response,
                                params,
                            });
                            return;
                        }

                        await this.activityLogService.logActivity({
                            action,
                            entityType,
                            entityId,
                            userId,
                            projectId,
                            details: {
                                method,
                                path,
                                params,
                            },
                            changes: {
                                old: body?.oldData,
                                new: body?.newData || body,
                            },
                        });
                    } catch (error) {
                        this.logger.error(`Error logging activity: ${error.message}`, error.stack);
                    }
                },
                error: (error) => {
                    this.logger.error(`Error in request: ${error.message}`, error.stack);
                },
            }),
        );
    }
} 