import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import prisma from './infra/prisma.js';
import { mountSwagger } from './config/swagger.js';
import { requestId } from './common/middleware/requestId.js';
import { requestContextMiddleware } from './common/context/requestContext.js';
import { generalLimiter } from './common/middleware/rateLimiters.js';
import { notFound } from './common/middleware/notFound.js';
import { errorHandler } from './common/middleware/errorHandler.js';

// ── Module routes ───────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import departmentRoutes from './modules/departments/departments.routes.js';
import doctorRoutes from './modules/doctors/doctors.routes.js';
import scheduleRoutes from './modules/schedules/schedules.routes.js';
import patientRoutes from './modules/patients/patients.routes.js';
import appointmentRoutes from './modules/appointments/appointments.routes.js';
import visitRoutes from './modules/visits/visits.routes.js';
import prescriptionRoutes from './modules/prescriptions/prescriptions.routes.js';
import diagnosticReportRoutes from './modules/diagnostic-reports/diagnostic-reports.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';

const app = express();

// ── Security & global infrastructure ────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(requestId);
app.use(requestContextMiddleware);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

// Body parsing with 100kb payload ceiling
app.use(express.json({ limit: '100kb' }));
app.use(generalLimiter);

// ── Health check endpoint with DB connectivity check ────────
const checkHealth = async (_req, res) => {
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (_err) {
    dbConnected = false;
  }

  const status = dbConnected ? 'ok' : 'degraded';
  const statusCode = dbConnected ? 200 : 503;

  return res.status(statusCode).json({
    status,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
};

app.get('/health', checkHealth);
app.get('/api/v1/health', checkHealth);
app.get('/', (_req, res) => res.redirect('/api-docs'));

// ── API documentation ───────────────────────────────────────
mountSwagger(app);

// ── API Routes (mounted under /api/v1) ───────────────────────
const v1 = '/api/v1';
app.use(`${v1}/auth`, authRoutes);
app.use(`${v1}/users`, userRoutes);
app.use(`${v1}/departments`, departmentRoutes);
app.use(`${v1}/doctors`, doctorRoutes);
app.use(`${v1}/schedules`, scheduleRoutes);
app.use(`${v1}/patients`, patientRoutes);
app.use(`${v1}/appointments`, appointmentRoutes);
app.use(`${v1}/visits`, visitRoutes);
app.use(`${v1}/prescriptions`, prescriptionRoutes);
app.use(`${v1}/diagnostic-reports`, diagnosticReportRoutes);
app.use(`${v1}/billing`, billingRoutes);
app.use(`${v1}/audit-logs`, auditRoutes);
app.use(`${v1}/reports`, reportRoutes);

// ── Error handling pipeline ─────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
