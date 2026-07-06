import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { toProjectDto } from '../lib/mappers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const projectSchema = z.object({
  name: z.string().min(2),
  key: z.string().min(2).max(8).toUpperCase(),
  description: z.string().min(10),
  status: z.enum(['PLANNING', 'ACTIVE', 'AT_RISK', 'DONE']),
  progress: z.number().min(0).max(100),
  dueDate: z.string().datetime(),
  ownerId: z.string().min(1)
});

const projectUpdateSchema = projectSchema.partial();

export const projectsRouter = Router();

projectsRouter.get('/', requireAuth, async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: { owner: true, tasks: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(projects.map(toProjectDto));
});

projectsRouter.post('/', requireAuth, requireRole('MANAGER'), async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid project payload' });
    return;
  }

  const project = await prisma.project.create({
    data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate) },
    include: { owner: true, tasks: true }
  });

  await prisma.activityLog.create({
    data: { message: `Created project ${project.key}`, actorId: req.user!.id }
  });

  res.status(201).json(toProjectDto(project));
});

projectsRouter.patch('/:id', requireAuth, requireRole('MANAGER'), async (req, res) => {
  const parsed = projectUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid project payload' });
    return;
  }

  const project = await prisma.project.update({
    where: { id: String(req.params.id) },
    data: { ...parsed.data, dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined },
    include: { owner: true, tasks: true }
  });

  await prisma.activityLog.create({ data: { message: `Updated project ${project.key}`, actorId: req.user!.id } });
  res.json(toProjectDto(project));
});

projectsRouter.delete('/:id', requireAuth, requireRole('MANAGER'), async (req, res) => {
  const project = await prisma.project.delete({ where: { id: String(req.params.id) } });
  await prisma.activityLog.create({ data: { message: `Deleted project ${project.key}`, actorId: req.user!.id } });
  res.status(204).send();
});
