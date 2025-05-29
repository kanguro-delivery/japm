import express, { Request, Response, RequestHandler } from 'express';
import { ActivityLogController } from '../controllers/activityLogController';
import { ActivityLogService } from '../services/activityLogService';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityEntityType } from '@prisma/client';

const router = express.Router();
const prismaService = new PrismaService();
const activityLogService = new ActivityLogService(prismaService);
const activityLogController = new ActivityLogController(activityLogService);

// Obtener logs de actividad con filtros
router.get('/', (req, res) => {
  activityLogController.getActivityLogs(
    req.query.projectId as string,
    req.query.userId as string,
    req.query.entityType as ActivityEntityType,
    req.query.entityId as string,
    req.query.startDate as string,
    req.query.endDate as string,
    req.query.page as string,
    req.query.limit as string,
  )
    .then(result => res.json(result))
    .catch(error => {
      console.error('Error al obtener logs de actividad:', error);
      res.status(500).json({ error: 'Error al obtener logs de actividad' });
    });
});

// Obtener logs de actividad para una entidad específica
router.get('/entity/:entityType/:entityId', (async (req, res) => {
  const { entityType, entityId } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId es requerido' });
  }

  try {
    const result = await activityLogController.getEntityActivity(
      projectId as string,
      entityType as ActivityEntityType,
      entityId,
    );
    res.json(result);
  } catch (error) {
    console.error('Error al obtener logs de actividad de la entidad:', error);
    res.status(500).json({ error: 'Error al obtener logs de actividad de la entidad' });
  }
}) as RequestHandler);

export default router;
