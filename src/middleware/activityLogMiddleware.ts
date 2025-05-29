import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ActivityLogService } from '../services/activityLogService';
import { ActivityAction, ActivityEntityType, User } from '@prisma/client';

interface RequestWithUser extends Request {
  user?: User;
}

@Injectable()
export class ActivityLogMiddleware implements NestMiddleware {
  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly entityType: ActivityEntityType
  ) { }

  use(req: RequestWithUser, res: Response, next: NextFunction) {
    const originalSend = res.send;
    const userId = req.user?.id;

    // Obtener projectId de diferentes fuentes posibles
    const projectId = req.params.projectId || req.body.projectId || req.query.projectId;

    if (!userId) {
      console.log('No se encontró userId en la solicitud');
      return next();
    }

    if (!projectId) {
      console.log('No se encontró projectId en la solicitud');
      return next();
    }

    res.send = function (body: any) {
      try {
        let responseBody;
        try {
          responseBody = typeof body === 'string' ? JSON.parse(body) : body;
        } catch (e) {
          console.log('Error al parsear el cuerpo de la respuesta:', e);
          return originalSend.call(this, body);
        }

        const entityId = req.params.id || responseBody?.id;

        if (entityId) {
          let action: ActivityAction;
          let changes: Record<string, any> | undefined;

          switch (req.method) {
            case 'POST':
              action = ActivityAction.CREATE;
              break;
            case 'PUT':
            case 'PATCH':
              action = ActivityAction.UPDATE;
              changes = {
                old: req.body,
                new: responseBody,
              };
              break;
            case 'DELETE':
              action = ActivityAction.DELETE;
              break;
            default:
              return originalSend.call(this, body);
          }

          console.log('Registrando actividad:', {
            action,
            entityType: this.entityType,
            entityId,
            userId,
            projectId,
          });

          this.activityLogService.logActivity({
            action,
            entityType: this.entityType,
            entityId,
            userId,
            projectId,
            changes,
          }).catch(error => {
            console.error('Error al registrar actividad:', error);
          });
        }
      } catch (error) {
        console.error('Error en el middleware de actividad:', error);
      }

      return originalSend.call(this, body);
    };

    next();
  }
}

export function createActivityLogMiddleware(entityType: ActivityEntityType) {
  return (activityLogService: ActivityLogService) => {
    return new ActivityLogMiddleware(activityLogService, entityType);
  };
}
