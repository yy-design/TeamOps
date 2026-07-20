import { Router } from 'express';
import type { DashboardDto, TaskStatus } from '@teamops/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const statuses: TaskStatus[] = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, async (req, res) => {
  const isAdmin = req.user!.role === 'ADMIN';
  const [projects, tasks, users, activities] = await Promise.all([
    prisma.project.findMany({ where: isAdmin ? undefined : { ownerId: req.user!.id } }),
    prisma.task.findMany({ where: isAdmin ? undefined : { assigneeId: req.user!.id }, include: { assignee: true } }),
    isAdmin
      ? prisma.user.findMany({ where: { active: true } })
      : prisma.user.findMany({ where: { id: req.user!.id, active: true } }),
    prisma.activityLog.findMany({
      where: isAdmin ? undefined : { actorId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 6
    })
  ]);

  const done = tasks.filter((task) => task.status === 'DONE').length;
  const overdue = tasks.filter((task) => task.status !== 'DONE' && task.dueDate < new Date()).length;
  const dashboard: DashboardDto = {
    summary: {
      totalProjects: projects.length,
      activeTasks: tasks.filter((task) => task.status !== 'DONE').length,
      overdueTasks: overdue,
      completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0
    },
    taskStatus: statuses.map((status) => ({ status, count: tasks.filter((task) => task.status === status).length })),
    workload: users.map((user) => ({
      user: user.name,
      color: user.avatarColor,
      tasks: tasks.filter((task) => task.assigneeId === user.id && task.status !== 'DONE').length
    })),
    recentActivity: activities.map((activity) => ({
      id: activity.id,
      message: activity.message,
      createdAt: activity.createdAt.toISOString()
    }))
  };

  res.json(dashboard);
});
