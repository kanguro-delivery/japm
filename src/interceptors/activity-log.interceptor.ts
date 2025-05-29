import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityLogService, ActivityEntityType, ActivityAction } from '../services/activityLogService';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(ActivityLogInterceptor.name);

    constructor(
        private readonly activityLogService: ActivityLogService,
        private readonly jwtService: JwtService
    ) { }

    private getEntityTypeFromPath(path: string): typeof ActivityEntityType[keyof typeof ActivityEntityType] | null {
        // Normalizar el path para asegurar que las comparaciones sean consistentes
        const normalizedPath = path.toLowerCase();

        this.logger.debug(`Analizando path para entityType: ${normalizedPath}`);

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

        this.logger.debug(`No se encontró entityType para el path: ${normalizedPath}`);
        return null;
    }

    private getActionFromMethod(method: string): typeof ActivityAction[keyof typeof ActivityAction] | null {
        this.logger.debug(`Analizando método para action: ${method}`);
        switch (method) {
            case 'POST':
                return ActivityAction.CREATE;
            case 'PUT':
            case 'PATCH':
                return ActivityAction.UPDATE;
            case 'DELETE':
                return ActivityAction.DELETE;
            default:
                this.logger.debug(`No se encontró action para el método: ${method}`);
                return null;
        }
    }

    private getProjectId(request: any): string | null {
        const projectId = request.body?.projectId ||
            request.params?.projectId ||
            request.query?.projectId ||
            request.headers['x-project-id'];

        this.logger.debug(`Buscando projectId en request:`, {
            bodyProjectId: request.body?.projectId,
            paramsProjectId: request.params?.projectId,
            queryProjectId: request.query?.projectId,
            headerProjectId: request.headers['x-project-id'],
            foundProjectId: projectId
        });

        return projectId;
    }

    private getUserId(request: any): string | null {
        // Primero intentamos obtener el ID del objeto user
        if (request.user?.id) {
            return request.user.id;
        }

        // Si no está en el objeto user, intentamos obtenerlo del token JWT
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = this.jwtService.decode(token);
                if (decoded && typeof decoded === 'object' && 'sub' in decoded) {
                    return decoded.sub;
                }
            } catch (error) {
                this.logger.warn(`Error al decodificar el token JWT: ${error.message}`);
            }
        }

        return null;
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, path, body, params, user } = request;

        this.logger.debug(`Interceptando petición:`, {
            method,
            path,
            body,
            params,
            user: user ? { id: user.id, email: user.email } : null
        });

        const entityType = this.getEntityTypeFromPath(path);
        const action = this.getActionFromMethod(method);

        if (!entityType || !action) {
            this.logger.debug(`No se registrará la actividad: entityType o action no encontrados`, {
                path,
                method,
                entityType,
                action
            });
            return next.handle();
        }

        const userId = this.getUserId(request);
        const projectId = this.getProjectId(request);

        if (!userId || !projectId) {
            this.logger.warn(`No se pudo registrar la actividad: userId o projectId faltante`, {
                userId,
                projectId,
                path,
                method,
                user: user ? { id: user.id, email: user.email } : null,
                headers: request.headers,
                body: request.body,
                params: request.params,
                query: request.query
            });
            return next.handle();
        }

        return next.handle().pipe(
            tap({
                next: async (response) => {
                    try {
                        const entityId = response?.id || params?.aiModelId || params?.id;
                        if (!entityId) {
                            this.logger.warn(`No se pudo obtener el entityId de la respuesta`, {
                                response,
                                params,
                            });
                            return;
                        }

                        this.logger.debug(`Registrando actividad:`, {
                            action,
                            entityType,
                            entityId,
                            userId,
                            projectId,
                            response: response ? { id: response.id } : null,
                            params
                        });

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

                        this.logger.debug(`Actividad registrada exitosamente`);
                    } catch (error) {
                        this.logger.error(`Error al registrar la actividad: ${error.message}`, error.stack);
                    }
                },
                error: (error) => {
                    this.logger.error(`Error en la petición: ${error.message}`, error.stack);
                },
            }),
        );
    }
} 