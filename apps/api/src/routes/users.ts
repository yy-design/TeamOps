import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { toUserDto } from '../lib/mappers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
  title: z.string().min(2),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']).optional(),
  title: z.string().min(2).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  active: z.boolean().optional()
});

usersRouter.get('/', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
  res.json(users.map(toUserDto));
});

usersRouter.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid user payload' });
    return;
  }

  const { password, ...userData } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { ...userData, passwordHash } });
  await prisma.activityLog.create({ data: { actorId: req.user!.id, message: `Created user ${user.email}` } });
  res.status(201).json(toUserDto(user));
});

usersRouter.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid user payload' });
    return;
  }

  const user = await prisma.user.update({ where: { id: String(req.params.id) }, data: parsed.data });
  await prisma.activityLog.create({ data: { actorId: req.user!.id, message: `Updated user ${user.email}` } });
  res.json(toUserDto(user));
});

usersRouter.patch('/:id/toggle-active', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = String(req.params.id);
  const current = await prisma.user.findUniqueOrThrow({ where: { id } });
  const user = await prisma.user.update({ where: { id }, data: { active: !current.active } });
  res.json(toUserDto(user));
});

usersRouter.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = String(req.params.id);
  if (id === req.user!.id) {
    res.status(400).json({ message: '不能删除当前登录账号' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      email: true,
      _count: {
        select: {
          ownedProjects: true,
          projectMembers: true,
          assignedTasks: true,
          reportedTasks: true,
          comments: true
        }
      }
    }
  });
  if (!user) {
    res.status(404).json({ message: '用户不存在' });
    return;
  }

  const businessRelations = {
    ownedProjects: user._count.ownedProjects,
    projectMembers: user._count.projectMembers,
    assignedTasks: user._count.assignedTasks,
    reportedTasks: user._count.reportedTasks,
    comments: user._count.comments
  };
  const hasBusinessData = Object.values(businessRelations).some((count) => count > 0);
  if (hasBusinessData) {
    const relationLabels = [
      businessRelations.ownedProjects ? `${businessRelations.ownedProjects} 个负责项目` : null,
      businessRelations.projectMembers ? `${businessRelations.projectMembers} 个项目成员关系` : null,
      businessRelations.assignedTasks ? `${businessRelations.assignedTasks} 个负责任务` : null,
      businessRelations.reportedTasks ? `${businessRelations.reportedTasks} 个创建任务` : null,
      businessRelations.comments ? `${businessRelations.comments} 条评论` : null
    ].filter(Boolean).join('、');
    res.status(409).json({ message: `该用户仍有关联数据：${relationLabels}，请先转移数据或禁用账号` });
    return;
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.activityLog.deleteMany({ where: { actorId: id } }),
    prisma.user.delete({ where: { id } })
  ]);
  await prisma.activityLog.create({ data: { actorId: req.user!.id, message: `Deleted user ${user.email}` } });
  res.status(204).send();
});
