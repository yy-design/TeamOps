import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { projectsRouter } from './routes/projects.js';
import { tasksRouter } from './routes/tasks.js';
import { usersRouter } from './routes/users.js';
import { notificationsRouter } from './routes/notifications.js';
import { swaggerDocument } from './swagger.js';

const configuredWebOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | undefined) {
  if (!origin || configuredWebOrigins.includes(origin)) {
    return true;
  }

  return (
    process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)
  );
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin))
    })
  );
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'teamops-api' }));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: 'Unexpected server error' });
  });

  return app;
}

export function asyncRoute<T extends express.RequestHandler>(handler: T): express.RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
