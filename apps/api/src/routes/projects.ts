import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { toProjectDto } from '../lib/mappers.js';
import { requireAuth } from '../middleware/auth.js';
import { hasGlobalDataAccess } from '../lib/permissions.js';

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

projectsRouter.get('/', requireAuth, async (req, res) => {
  const isAdmin = hasGlobalDataAccess(req.user!.role);
  const projects = await prisma.project.findMany({
    where: isAdmin ? undefined : { ownerId: req.user!.id },
    include: { owner: true, tasks: isAdmin ? true : { where: { assigneeId: req.user!.id } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(projects.map(toProjectDto));
});

projectsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid project payload' });
    return;
  }

  const isAdmin = hasGlobalDataAccess(req.user!.role);
  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      ownerId: isAdmin ? parsed.data.ownerId : req.user!.id,
      dueDate: new Date(parsed.data.dueDate)
    },
    include: { owner: true, tasks: true }
  });

  await prisma.activityLog.create({
    data: { message: `Created project ${project.key}`, actorId: req.user!.id }
  });

  res.status(201).json(toProjectDto(project));
});

projectsRouter.patch('/:id', requireAuth, async (req, res) => {
  const parsed = projectUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid project payload' });
    return;
  }

  const id = String(req.params.id);
  const isAdmin = hasGlobalDataAccess(req.user!.role);
  const existing = await prisma.project.findFirst({ where: { id, ...(isAdmin ? {} : { ownerId: req.user!.id }) } });
  if (!existing) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }

  const { ownerId, ...updates } = parsed.data;
  const project = await prisma.project.update({
    where: { id },
    data: {
      ...updates,
      ownerId: isAdmin ? ownerId : req.user!.id,
      dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined
    },
    include: { owner: true, tasks: true }
  });

  await prisma.activityLog.create({ data: { message: `Updated project ${project.key}`, actorId: req.user!.id } });
  res.json(toProjectDto(project));
});

projectsRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const isAdmin = hasGlobalDataAccess(req.user!.role);
  const project = await prisma.project.findFirst({
    where: { id, ...(isAdmin ? {} : { ownerId: req.user!.id }) },
    include: { tasks: { select: { assigneeId: true } } }
  });
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  if (!isAdmin && project.tasks.some((task) => task.assigneeId !== req.user!.id)) {
    res.status(409).json({ message: '项目包含分配给其他成员的任务，请先转移任务或由管理员删除' });
    return;
  }

  await prisma.project.delete({ where: { id } });
  await prisma.activityLog.create({ data: { message: `Deleted project ${project.key}`, actorId: req.user!.id } });
  res.status(204).send();
});
