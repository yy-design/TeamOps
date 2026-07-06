import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { toTaskDto } from '../lib/mappers.js';
import { requireAuth } from '../middleware/auth.js';

const taskSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(8),
  status: z.enum(['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().datetime(),
  projectId: z.string().min(1),
  assigneeId: z.string().min(1)
});

const taskUpdateSchema = taskSchema.partial();
const commentSchema = z.object({ body: z.string().min(2).max(800) });

const include = {
  project: true,
  assignee: true,
  reporter: true,
  comments: { include: { author: true }, orderBy: { createdAt: 'desc' as const } }
};

export const tasksRouter = Router();

tasksRouter.get('/', requireAuth, async (req, res) => {
  const { status, projectId, assigneeId, search } = req.query;
  const tasks = await prisma.task.findMany({
    where: {
      status: typeof status === 'string' && status !== 'ALL' ? (status as never) : undefined,
      projectId: typeof projectId === 'string' && projectId !== 'ALL' ? projectId : undefined,
      assigneeId: typeof assigneeId === 'string' && assigneeId !== 'ALL' ? assigneeId : undefined,
      title: typeof search === 'string' && search ? { contains: search } : undefined
    },
    include,
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }]
  });
  res.json(tasks.map(toTaskDto));
});

tasksRouter.post('/', requireAuth, async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid task payload' });
    return;
  }

  const task = await prisma.task.create({
    data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate), reporterId: req.user!.id },
    include
  });

  await Promise.all([
    prisma.notification.create({
      data: {
        userId: parsed.data.assigneeId,
        title: 'New task assigned',
        body: `${task.title} is ready for your attention.`
      }
    }),
    prisma.activityLog.create({ data: { message: `Created task ${task.title}`, actorId: req.user!.id } })
  ]);

  res.status(201).json(toTaskDto(task));
});

tasksRouter.patch('/:id/status', requireAuth, async (req, res) => {
  const parsed = z.object({ status: z.enum(['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid status' });
    return;
  }

  const task = await prisma.task.update({ where: { id: String(req.params.id) }, data: parsed.data, include });
  await prisma.activityLog.create({ data: { message: `Moved ${task.title} to ${task.status}`, actorId: req.user!.id } });
  const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include });
  res.json(toTaskDto(updated));
});

tasksRouter.patch('/:id', requireAuth, async (req, res) => {
  const parsed = taskUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid task payload' });
    return;
  }

  const task = await prisma.task.update({
    where: { id: String(req.params.id) },
    data: { ...parsed.data, dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined },
    include
  });
  await prisma.activityLog.create({ data: { message: `Updated task ${task.title}`, actorId: req.user!.id } });
  const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include });
  res.json(toTaskDto(updated));
});

tasksRouter.delete('/:id', requireAuth, async (req, res) => {
  const task = await prisma.task.delete({ where: { id: String(req.params.id) } });
  await prisma.activityLog.create({ data: { message: `Deleted task ${task.title}`, actorId: req.user!.id } });
  res.status(204).send();
});

tasksRouter.post('/:id/comments', requireAuth, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid comment payload' });
    return;
  }

  const task = await prisma.task.findUniqueOrThrow({ where: { id: String(req.params.id) }, include });
  await prisma.comment.create({ data: { taskId: task.id, authorId: req.user!.id, body: parsed.data.body } });
  await Promise.all([
    prisma.activityLog.create({ data: { message: `Commented on ${task.title}`, actorId: req.user!.id } }),
    prisma.notification.create({
      data: {
        userId: task.reporterId === req.user!.id ? task.assigneeId : task.reporterId,
        title: 'New task comment',
        body: `${task.title} has a new comment.`
      }
    })
  ]);

  const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include });
  res.status(201).json(toTaskDto(updated));
});
