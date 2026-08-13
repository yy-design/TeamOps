import { Router } from 'express';
import { z } from 'zod';
import type { TaskStatus } from '@teamops/shared';
import { prisma } from '../lib/prisma.js';
import { publishNotificationEvent } from '../lib/notificationEvents.js';
import { toTaskDto } from '../lib/mappers.js';
import { requireAuth } from '../middleware/auth.js';
import {
  canManageProjectResource,
  canTransitionTask,
  hasGlobalDataAccess
} from '../lib/permissions.js';

const taskSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(8),
  status: z.enum(['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().datetime(),
  projectId: z.string().min(1),
  sprintId: z.string().min(1).nullable().optional(),
  assigneeId: z.string().min(1)
});

const taskUpdateSchema = taskSchema.omit({ status: true }).partial().strict();
const statusSchema = z.object({ status: z.enum(['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']) });
const commentSchema = z.object({ body: z.string().min(2).max(800) });

const include = {
  project: { include: { members: { include: { user: true } } } },
  sprint: true,
  assignee: true,
  reporter: true,
  comments: { include: { author: true }, orderBy: { createdAt: 'desc' as const } }
};

export const tasksRouter = Router();

tasksRouter.get('/', requireAuth, async (req, res) => {
  const { status, projectId, assigneeId, search } = req.query;
  const isAdmin = hasGlobalDataAccess(req.user!.role);
  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        isAdmin ? {} : { project: { members: { some: { userId: req.user!.id } } } },
        {
          status: typeof status === 'string' && status !== 'ALL' ? status : undefined,
          projectId: typeof projectId === 'string' && projectId !== 'ALL' ? projectId : undefined,
          assigneeId: typeof assigneeId === 'string' && assigneeId !== 'ALL' ? assigneeId : undefined,
          title: typeof search === 'string' && search ? { contains: search } : undefined
        }
      ]
    },
    include,
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }]
  });
  res.json(tasks.map((task) => toTaskDto(task, req.user!)));
});

tasksRouter.post('/', requireAuth, async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.status !== 'BACKLOG') {
    res.status(400).json({ message: 'New tasks must start in BACKLOG with a valid payload' });
    return;
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    include: { members: { include: { user: true } } }
  });
  if (!project || !canManageProjectResource(req.user!, project.ownerId)) {
    res.status(403).json({ message: 'You cannot create a task in this project' });
    return;
  }

  const assigneeMembership = project.members.find((member) => member.userId === parsed.data.assigneeId);
  if (!assigneeMembership || assigneeMembership.role === 'VIEWER' || !assigneeMembership.user.active) {
    res.status(400).json({ message: 'Assignee must be an active OWNER or MEMBER of the project' });
    return;
  }
  if (parsed.data.sprintId) {
    const sprint = await prisma.sprint.findFirst({
      where: { id: parsed.data.sprintId, projectId: project.id, status: { not: 'COMPLETED' } }
    });
    if (!sprint) {
      res.status(400).json({ message: 'Sprint must belong to the project and not be completed' });
      return;
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate), reporterId: req.user!.id },
      include
    });
    await tx.notification.create({
      data: {
        userId: parsed.data.assigneeId,
        title: 'New task assigned',
        body: `${created.title} is ready for your attention.`
      }
    });
    await tx.activityLog.create({ data: { message: `Created task ${created.title}`, actorId: req.user!.id } });
    return created;
  });

  publishNotificationEvent(parsed.data.assigneeId);
  res.status(201).json(toTaskDto(task, req.user!));
});

tasksRouter.patch('/:id/status', requireAuth, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid status' });
    return;
  }

  const id = String(req.params.id);
  const existing = await prisma.task.findUnique({ where: { id }, include });
  if (!existing) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }

  const canReview = canManageProjectResource(req.user!, existing.project.ownerId);
  const isAssignee = existing.assigneeId === req.user!.id;
  if (!canReview && !isAssignee) {
    res.status(403).json({ message: 'Only the assignee or project owner can change task status' });
    return;
  }
  if (parsed.data.status === 'DONE' && !canReview) {
    res.status(403).json({ message: 'Only the project owner or administrator can approve a task as DONE' });
    return;
  }
  if (!canTransitionTask(existing.status as TaskStatus, parsed.data.status, canReview)) {
    res.status(409).json({ message: `Invalid task transition: ${existing.status} -> ${parsed.data.status}` });
    return;
  }

  const wipStatuses: TaskStatus[] = ['IN_PROGRESS', 'REVIEW'];
  const entersWip = wipStatuses.includes(parsed.data.status) && !wipStatuses.includes(existing.status as TaskStatus);
  if (existing.sprint && entersWip) {
    if (existing.sprint.status !== 'ACTIVE') {
      res.status(409).json({ message: 'Only tasks in an ACTIVE sprint can enter work in progress' });
      return;
    }
    const activeTaskCount = await prisma.task.count({
      where: { sprintId: existing.sprint.id, status: { in: wipStatuses } }
    });
    if (activeTaskCount >= existing.sprint.wipLimit) {
      res.status(409).json({ message: `Sprint WIP limit (${existing.sprint.wipLimit}) has been reached` });
      return;
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data: parsed.data, include });
    await tx.activityLog.create({ data: { message: `Moved ${updated.title} to ${updated.status}`, actorId: req.user!.id } });

    const recipientId = parsed.data.status === 'REVIEW'
      ? updated.project.ownerId
      : parsed.data.status === 'DONE'
        ? updated.assigneeId
        : undefined;
    if (recipientId && recipientId !== req.user!.id) {
      await tx.notification.create({
        data: {
          userId: recipientId,
          title: parsed.data.status === 'REVIEW' ? 'Task ready for review' : 'Task approved',
          body: `${updated.title} moved to ${parsed.data.status}.`
        }
      });
    }
    return updated;
  });

  const statusRecipientId = parsed.data.status === 'REVIEW'
    ? task.project.ownerId
    : parsed.data.status === 'DONE'
      ? task.assigneeId
      : undefined;
  if (statusRecipientId && statusRecipientId !== req.user!.id) {
    publishNotificationEvent(statusRecipientId);
  }
  res.json(toTaskDto(task, req.user!));
});

tasksRouter.patch('/:id', requireAuth, async (req, res) => {
  const parsed = taskUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Task metadata is invalid; change status through the status endpoint' });
    return;
  }

  const id = String(req.params.id);
  const existing = await prisma.task.findUnique({ where: { id }, include });
  if (!existing) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  if (!canManageProjectResource(req.user!, existing.project.ownerId)) {
    res.status(403).json({ message: 'Only the project owner or administrator can edit task metadata' });
    return;
  }

  const targetProjectId = parsed.data.projectId ?? existing.projectId;
  const targetProject = targetProjectId === existing.projectId
    ? existing.project
    : await prisma.project.findUnique({
        where: { id: targetProjectId },
        include: { members: { include: { user: true } } }
      });
  if (!targetProject || !canManageProjectResource(req.user!, targetProject.ownerId)) {
    res.status(403).json({ message: 'You cannot move this task to that project' });
    return;
  }

  const assigneeId = parsed.data.assigneeId ?? existing.assigneeId;
  const assigneeMembership = targetProject.members.find((member) => member.userId === assigneeId);
  if (!assigneeMembership || assigneeMembership.role === 'VIEWER' || !assigneeMembership.user.active) {
    res.status(400).json({ message: 'Assignee must be an active OWNER or MEMBER of the target project' });
    return;
  }

  const sprintId = parsed.data.sprintId === undefined
    ? (targetProjectId === existing.projectId ? existing.sprintId : null)
    : parsed.data.sprintId;
  if (sprintId) {
    const sprint = await prisma.sprint.findFirst({
      where: { id: sprintId, projectId: targetProjectId, status: { not: 'COMPLETED' } }
    });
    if (!sprint) {
      res.status(400).json({ message: 'Sprint must belong to the target project and not be completed' });
      return;
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        ...parsed.data,
        sprintId,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined
      },
      include
    });
    await tx.activityLog.create({ data: { message: `Updated task ${updated.title}`, actorId: req.user!.id } });
    if (assigneeId !== existing.assigneeId) {
      await tx.notification.create({
        data: { userId: assigneeId, title: 'Task reassigned', body: `${updated.title} was assigned to you.` }
      });
    }
    return updated;
  });

  if (assigneeId !== existing.assigneeId) {
    publishNotificationEvent(assigneeId);
  }
  res.json(toTaskDto(task, req.user!));
});

tasksRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.task.findUnique({ where: { id }, include: { project: true } });
  if (!existing) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  if (!canManageProjectResource(req.user!, existing.project.ownerId)) {
    res.status(403).json({ message: 'Only the project owner or administrator can delete tasks' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id } });
    await tx.activityLog.create({ data: { message: `Deleted task ${existing.title}`, actorId: req.user!.id } });
  });
  res.status(204).send();
});

tasksRouter.post('/:id/comments', requireAuth, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid comment payload' });
    return;
  }

  const task = await prisma.task.findUnique({ where: { id: String(req.params.id) }, include });
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }

  const canManage = canManageProjectResource(req.user!, task.project.ownerId);
  if (!canManage && task.assigneeId !== req.user!.id) {
    res.status(403).json({ message: 'Only the assignee or project owner can comment on this task' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.create({ data: { taskId: task.id, authorId: req.user!.id, body: parsed.data.body } });
    await tx.activityLog.create({ data: { message: `Commented on ${task.title}`, actorId: req.user!.id } });
    const recipientId = task.reporterId === req.user!.id ? task.assigneeId : task.reporterId;
    if (recipientId !== req.user!.id) {
      await tx.notification.create({
        data: { userId: recipientId, title: 'New task comment', body: `${task.title} has a new comment.` }
      });
    }
  });

  const commentRecipientId = task.reporterId === req.user!.id ? task.assigneeId : task.reporterId;
  if (commentRecipientId !== req.user!.id) {
    publishNotificationEvent(commentRecipientId);
  }
  const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include });
  res.status(201).json(toTaskDto(updated, req.user!));
});
