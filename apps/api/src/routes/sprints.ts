import { Router } from 'express';
import { z } from 'zod';
import type { SprintStatus } from '@teamops/shared';
import { prisma } from '../lib/prisma.js';
import { toSprintDto } from '../lib/mappers.js';
import { canManageProjectResource, hasGlobalDataAccess } from '../lib/permissions.js';
import { requireAuth } from '../middleware/auth.js';
import { publishNotificationEvent } from '../lib/notificationEvents.js';
import { createPlanningSprint, SprintDomainError } from '../services/sprintService.js';

const sprintSchema = z.object({
  name: z.string().min(2).max(80),
  goal: z.string().min(5).max(500),
  projectId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  wipLimit: z.number().int().min(1).max(30)
});
const sprintUpdateSchema = sprintSchema.omit({ projectId: true }).partial().strict();
const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED']),
  incompleteTaskAction: z.enum(['MOVE_TO_BACKLOG']).optional()
}).strict();
const include = { project: true, tasks: true };
const transitions: Record<SprintStatus, SprintStatus[]> = {
  PLANNING: ['ACTIVE'],
  ACTIVE: ['COMPLETED'],
  COMPLETED: []
};

export const sprintsRouter = Router();

sprintsRouter.get('/', requireAuth, async (req, res) => {
  const sprints = await prisma.sprint.findMany({
    where: hasGlobalDataAccess(req.user!.role)
      ? undefined
      : { project: { members: { some: { userId: req.user!.id } } } },
    include,
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }]
  });
  res.json(sprints.map((sprint) => toSprintDto(sprint, req.user!)));
});

sprintsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = sprintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid sprint payload' });
    return;
  }
  try {
    const { sprint, recipientIds } = await createPlanningSprint(req.user!, {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate)
    });
    recipientIds.forEach(publishNotificationEvent);
    res.status(201).json(toSprintDto(sprint, req.user!));
  } catch (error) {
    if (error instanceof SprintDomainError) {
      res.status(error.status).json({ message: error.message, code: error.code });
      return;
    }
    throw error;
  }
});

sprintsRouter.patch('/:id', requireAuth, async (req, res) => {
  const parsed = sprintUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid sprint payload' });
    return;
  }
  const existing = await prisma.sprint.findUnique({ where: { id: String(req.params.id) }, include });
  if (!existing) {
    res.status(404).json({ message: 'Sprint not found' });
    return;
  }
  if (!canManageProjectResource(req.user!, existing.project.ownerId)) {
    res.status(403).json({ message: 'You cannot manage this sprint' });
    return;
  }
  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : existing.startDate;
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : existing.endDate;
  if (startDate >= endDate) {
    res.status(400).json({ message: 'Sprint start date must be before end date' });
    return;
  }

  const sprint = await prisma.sprint.update({
    where: { id: existing.id },
    data: { ...parsed.data, startDate, endDate },
    include
  });
  res.json(toSprintDto(sprint, req.user!));
});

sprintsRouter.patch('/:id/status', requireAuth, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid sprint status' });
    return;
  }
  const existing = await prisma.sprint.findUnique({ where: { id: String(req.params.id) }, include });
  if (!existing) {
    res.status(404).json({ message: 'Sprint not found' });
    return;
  }
  if (!canManageProjectResource(req.user!, existing.project.ownerId)) {
    res.status(403).json({ message: 'You cannot manage this sprint' });
    return;
  }
  if (!transitions[existing.status as SprintStatus].includes(parsed.data.status)) {
    res.status(409).json({ message: `Invalid sprint transition: ${existing.status} -> ${parsed.data.status}` });
    return;
  }
  if (parsed.data.status === 'ACTIVE') {
    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId: existing.projectId, status: 'ACTIVE', id: { not: existing.id } }
    });
    if (activeSprint) {
      res.status(409).json({ message: `项目中已有进行中的迭代“${activeSprint.name}”，请先结束后再启动新的迭代` });
      return;
    }
  }

  const unfinishedTasks = existing.tasks.filter((task) => task.status !== 'DONE');
  const shouldMoveIncomplete = parsed.data.incompleteTaskAction === 'MOVE_TO_BACKLOG';
  if (parsed.data.status === 'COMPLETED' && unfinishedTasks.length > 0 && !shouldMoveIncomplete) {
    res.status(409).json({
      message: `当前迭代还有 ${unfinishedTasks.length} 个未完成任务，请完成任务或选择移回待办后结束`,
      code: 'SPRINT_HAS_UNFINISHED_TASKS',
      unfinishedTaskCount: unfinishedTasks.length
    });
    return;
  }

  const sprint = await prisma.$transaction(async (tx) => {
    let movedTaskCount = 0;
    if (parsed.data.status === 'COMPLETED' && shouldMoveIncomplete) {
      const result = await tx.task.updateMany({
        where: { sprintId: existing.id, status: { not: 'DONE' } },
        data: { sprintId: null, status: 'BACKLOG' }
      });
      movedTaskCount = result.count;
    }

    const updated = await tx.sprint.update({
      where: { id: existing.id },
      data: { status: parsed.data.status },
      include
    });
    const detail = movedTaskCount > 0 ? ` and returned ${movedTaskCount} unfinished tasks to backlog` : '';
    await tx.activityLog.create({
      data: { actorId: req.user!.id, message: `Moved sprint ${updated.name} to ${updated.status}${detail}` }
    });
    return updated;
  });
  res.json(toSprintDto(sprint, req.user!));
});

sprintsRouter.delete('/:id', requireAuth, async (req, res) => {
  const sprint = await prisma.sprint.findUnique({ where: { id: String(req.params.id) }, include });
  if (!sprint) {
    res.status(404).json({ message: 'Sprint not found' });
    return;
  }
  if (!canManageProjectResource(req.user!, sprint.project.ownerId)) {
    res.status(403).json({ message: 'You cannot delete this sprint' });
    return;
  }
  if (sprint.status !== 'PLANNING' || sprint.tasks.length > 0) {
    res.status(409).json({ message: 'Only empty planning sprints can be deleted' });
    return;
  }
  await prisma.sprint.delete({ where: { id: sprint.id } });
  res.status(204).send();
});
