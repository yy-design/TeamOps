import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { subscribeToNotificationEvents } from '../lib/notificationEvents.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter = Router();

notificationsRouter.get('/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendChange = () => {
    res.write(`event: notifications.changed\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  };
  const unsubscribe = subscribeToNotificationEvents(req.user!.id, sendChange);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20_000);
  res.write('event: connected\ndata: {}\n\n');

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

notificationsRouter.get('/', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notifications.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })));
});

notificationsRouter.patch('/read-all', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notifications.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })));
});

notificationsRouter.patch('/:id/read', requireAuth, async (req, res) => {
  const notification = await prisma.notification.update({
    where: { id: String(req.params.id), userId: req.user!.id },
    data: { read: true }
  });
  res.json({ ...notification, createdAt: notification.createdAt.toISOString() });
});
