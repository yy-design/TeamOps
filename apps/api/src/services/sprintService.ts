import { Prisma } from '@prisma/client';
import type { PermissionActor } from '../lib/permissions.js';
import { canManageProjectResource } from '../lib/permissions.js';
import { prisma } from '../lib/prisma.js';

export interface CreatePlanningSprintInput {
  name: string;
  goal: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  wipLimit: number;
  taskIds?: string[];
}

export class SprintDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

const sprintInclude = { project: true, tasks: true } as const;

export async function createPlanningSprintInTransaction(
  tx: Prisma.TransactionClient,
  actor: PermissionActor,
  input: CreatePlanningSprintInput
) {
  if (input.startDate >= input.endDate) {
    throw new SprintDomainError('迭代开始日期必须早于结束日期', 400, 'INVALID_DATE_RANGE');
  }
  if (input.wipLimit < 1 || input.wipLimit > 30) {
    throw new SprintDomainError('WIP 上限必须在 1 到 30 之间', 400, 'INVALID_WIP_LIMIT');
  }

  const project = await tx.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new SprintDomainError('项目不存在', 404, 'PROJECT_NOT_FOUND');
  if (!canManageProjectResource(actor, project.ownerId)) {
    throw new SprintDomainError('当前用户无权为该项目创建迭代', 403, 'FORBIDDEN');
  }

  const taskIds = [...new Set(input.taskIds ?? [])];

  const tasks = taskIds.length
    ? await tx.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, projectId: true, sprintId: true, status: true, assigneeId: true }
      })
    : [];
  if (tasks.length !== taskIds.length) {
    throw new SprintDomainError('部分候选任务已不存在，请重新生成方案', 409, 'STALE_PROPOSAL');
  }
  if (tasks.some((task) => task.projectId !== project.id || task.sprintId || task.status !== 'BACKLOG')) {
    throw new SprintDomainError('候选任务状态或迭代归属已变化，请重新生成方案', 409, 'STALE_PROPOSAL');
  }

  const created = await tx.sprint.create({
    data: {
      name: input.name,
      goal: input.goal,
      projectId: input.projectId,
      startDate: input.startDate,
      endDate: input.endDate,
      wipLimit: input.wipLimit,
      status: 'PLANNING'
    }
  });

  if (taskIds.length) {
    const linked = await tx.task.updateMany({
      where: {
        id: { in: taskIds },
        projectId: project.id,
        sprintId: null,
        status: 'BACKLOG'
      },
      data: { sprintId: created.id }
    });
    if (linked.count !== taskIds.length) {
      throw new SprintDomainError('候选任务已被其他操作修改，请重新生成方案', 409, 'STALE_PROPOSAL');
    }
  }

  await tx.activityLog.create({
    data: {
      actorId: actor.id,
      message: `Created sprint ${created.name}${taskIds.length ? ` with ${taskIds.length} planned tasks` : ''}`
    }
  });

  const recipientIds = [...new Set(tasks.map((task) => task.assigneeId).filter((id) => id !== actor.id))];
  if (recipientIds.length) {
    await tx.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        title: '任务已加入新迭代',
        body: `${created.name} 已创建，你负责的任务已进入本次规划。`
      }))
    });
  }

  const sprint = await tx.sprint.findUniqueOrThrow({ where: { id: created.id }, include: sprintInclude });
  return { sprint, recipientIds };
}

export function createPlanningSprint(actor: PermissionActor, input: CreatePlanningSprintInput) {
  return prisma.$transaction((tx) => createPlanningSprintInTransaction(tx, actor, input));
}