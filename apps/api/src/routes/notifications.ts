import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter = Router();

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
