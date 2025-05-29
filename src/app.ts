import express from 'express';
import activityLogRoutes from './routes/activityLogRoutes';

const app = express();

// Rutas de actividad
app.use('/api/activity-logs', activityLogRoutes);

// ... existing code ...
