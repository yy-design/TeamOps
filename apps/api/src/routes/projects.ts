import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { toProjectDto, toUserDto } from '../lib/mappers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { canManageProjectResource, canManageProjects, hasGlobalDataAccess } from '../lib/permissions.js';

const membershipFields = {
  memberIds: z.array(z.string().min(1)).optional(),
  viewerIds: z.array(z.string().min(1)).optional()
};

const projectSchema = z.object({
  name: z.string().min(2),
  key: z.string().min(2).max(8).toUpperCase(),
  description: z.string().min(10),
  status: z.enum(['PLANNING', 'ACTIVE', 'AT_RISK', 'DONE']),
  dueDate: z.string().datetime(),
  ownerId: z.string().min(1),
  ...membershipFields
});

const projectUpdateSchema = projectSchema.partial();
const projectInclude = {
  owner: true,
  members: { include: { user: true }, orderBy: { joinedAt: 'asc' as const } },
  tasks: true
};

function buildMemberships(ownerId: string, memberIds: string[] = [], viewerIds: string[] = []) {
  const roles = new Map<string, 'OWNER' | 'MEMBER' | 'VIEWER'>();
  viewerIds.forEach((userId) => roles.set(userId, 'VIEWER'));
  memberIds.forEach((userId) => roles.set(userId, 'MEMBER'));
  roles.set(ownerId, 'OWNER');
  return [...roles].map(([userId, role]) => ({ userId, role }));
}

async function membershipsAreValid(memberships: Array<{ userId: string; role: string }>) {
  const users = await prisma.user.findMany({
    where: { id: { in: memberships.map((member) => member.userId) }, active: true },
    select: { id: true, role: true }
  });
  const owner = memberships.find((member) => member.role === 'OWNER');
  const ownerUser = users.find((user) => user.id === owner?.userId);
  return users.length === memberships.length && Boolean(ownerUser && ['ADMIN', 'MANAGER'].includes(ownerUser.role));
}

export const projectsRouter = Router();

projectsRouter.get('/member-candidates', requireAuth, requireRole('MANAGER'), async (_req, res) => {
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  res.json(users.map(toUserDto));
});

projectsRouter.get('/', requireAuth, async (req, res) => {
  const isAdmin = hasGlobalDataAccess(req.user!.role);
  const projects = await prisma.project.findMany({
    where: isAdmin ? undefined : { members: { some: { userId: req.user!.id } } },
    include: projectInclude,
    orderBy: { createdAt: 'desc' }
  });
  res.json(projects.map((project) => toProjectDto(project, req.user!)));
});

projectsRouter.post('/', requireAuth, async (req, res) => {
  if (!canManageProjects(req.user!.role)) {
    res.status(403).json({ message: 'Only administrators and managers can create projects' });
    return;
  }

  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid project payload' });
    return;
  }

  const { memberIds, viewerIds, ownerId: requestedOwnerId, ...projectData } = parsed.data;
  const ownerId = hasGlobalDataAccess(req.user!.role) ? requestedOwnerId : req.user!.id;
  const memberships = buildMemberships(ownerId, memberIds, viewerIds);
  if (!(await membershipsAreValid(memberships))) {
    res.status(400).json({ message: 'Project owner or members are invalid or inactive' });
    return;
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        ...projectData,
        ownerId,
        dueDate: new Date(projectData.dueDate),
        members: { create: memberships.map(({ userId, role }) => ({ userId, role })) }
      },
      include: projectInclude
    });
    await tx.activityLog.create({ data: { message: `Created project ${created.key}`, actorId: req.user!.id } });
    return created;
  });

  res.status(201).json(toProjectDto(project, req.user!));
});

projectsRouter.patch('/:id', requireAuth, async (req, res) => {
  const parsed = projectUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid project payload' });
    return;
  }

  const id = String(req.params.id);
  const existing = await prisma.project.findUnique({
    where: { id },
    include: { members: true }
  });
  if (!existing) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  if (!canManageProjectResource(req.user!, existing.ownerId)) {
    res.status(403).json({ message: 'You cannot manage this project' });
    return;
  }

  const { ownerId: requestedOwnerId, memberIds, viewerIds, ...updates } = parsed.data;
  const ownerId = hasGlobalDataAccess(req.user!.role) && requestedOwnerId ? requestedOwnerId : existing.ownerId;
  const currentMemberIds = existing.members.filter((member) => member.role === 'MEMBER').map((member) => member.userId);
  const currentViewerIds = existing.members.filter((member) => member.role === 'VIEWER').map((member) => member.userId);
  const memberships = buildMemberships(ownerId, memberIds ?? currentMemberIds, viewerIds ?? currentViewerIds);
  if (!(await membershipsAreValid(memberships))) {
    res.status(400).json({ message: 'Project owner or members are invalid or inactive' });
    return;
  }

  const project = await prisma.$transaction(async (tx) => {
    await tx.projectMember.deleteMany({ where: { projectId: id } });
    const updated = await tx.project.update({
      where: { id },
      data: {
        ...updates,
        ownerId,
        dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
        members: { create: memberships.map(({ userId, role }) => ({ userId, role })) }
      },
      include: projectInclude
    });
    await tx.activityLog.create({ data: { message: `Updated project ${updated.key}`, actorId: req.user!.id } });
    return updated;
  });

  res.json(toProjectDto(project, req.user!));
});

projectsRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  if (!canManageProjectResource(req.user!, project.ownerId)) {
    res.status(403).json({ message: 'You cannot delete this project' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.delete({ where: { id } });
    await tx.activityLog.create({ data: { message: `Deleted project ${project.key}`, actorId: req.user!.id } });
  });
  res.status(204).send();
});
