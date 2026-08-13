import { tool } from 'ai';
import { z } from 'zod';
import type { TaskStatus } from '@teamops/shared';
import type { PermissionActor } from '../lib/permissions.js';
import { prisma } from '../lib/prisma.js';
import { prepareSprintProposal, recordToolStep } from '../services/agentExecutionService.js';

const taskStatuses = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'] as const;

function visibleProjectWhere(actor: PermissionActor) {
  return actor.role === 'ADMIN' ? {} : { members: { some: { userId: actor.id } } };
}

export function buildAgentTools(runId: string, actor: PermissionActor, markApproval: () => void) {
  let sequence = 0;
  const record = <T>(name: string, input: unknown, execute: () => Promise<T>) =>
    recordToolStep(runId, ++sequence, name, input, execute);

  return {
    listProjects: tool({
      description: '查询当前用户有权访问的项目及其任务完成情况。',
      inputSchema: z.object({ status: z.enum(['PLANNING', 'ACTIVE', 'AT_RISK', 'DONE']).optional() }),
      execute: async (input) => record('listProjects', input, async () => {
        const projects = await prisma.project.findMany({
          where: { ...visibleProjectWhere(actor), ...(input.status ? { status: input.status } : {}) },
          include: { tasks: true, owner: true },
          orderBy: { dueDate: 'asc' },
          take: 20
        });
        return projects.map((project) => {
          const completed = project.tasks.filter((task) => task.status === 'DONE').length;
          return {
            key: project.key,
            name: project.name,
            status: project.status,
            owner: project.owner.name,
            dueDate: project.dueDate.toISOString(),
            taskCount: project.tasks.length,
            completedTaskCount: completed,
            progress: project.tasks.length ? Math.round((completed / project.tasks.length) * 100) : 0
          };
        });
      })
    }),

    listProjectTasks: tool({
      description: '按项目 Key 查询任务，可筛选任务状态，用于分析延期、阻塞和优先级。',
      inputSchema: z.object({ projectKey: z.string().min(2).max(8), status: z.enum(taskStatuses).optional() }),
      execute: async (input) => record('listProjectTasks', input, async () => {
        const project = await prisma.project.findFirst({
          where: { key: input.projectKey.toUpperCase(), ...visibleProjectWhere(actor) },
          select: { id: true, key: true, name: true }
        });
        if (!project) return { error: '项目不存在或当前用户无权访问' };
        const tasks = await prisma.task.findMany({
          where: { projectId: project.id, ...(input.status ? { status: input.status } : {}) },
          include: { assignee: true, sprint: true },
          orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
          take: 50
        });
        return {
          project,
          tasks: tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status as TaskStatus,
            priority: task.priority,
            dueDate: task.dueDate.toISOString(),
            assignee: task.assignee.name,
            sprint: task.sprint?.name ?? null,
            overdue: task.status !== 'DONE' && task.dueDate < new Date()
          }))
        };
      })
    }),
    inspectActiveSprint: tool({
      description: '查询项目当前进行中的 Sprint、完成度、WIP 容量和未完成任务。',
      inputSchema: z.object({ projectKey: z.string().min(2).max(8) }),
      execute: async (input) => record('inspectActiveSprint', input, async () => {
        const project = await prisma.project.findFirst({
          where: { key: input.projectKey.toUpperCase(), ...visibleProjectWhere(actor) },
          select: { id: true, key: true, name: true }
        });
        if (!project) return { error: '项目不存在或当前用户无权访问' };
        const sprint = await prisma.sprint.findFirst({
          where: { projectId: project.id, status: 'ACTIVE' },
          include: { tasks: { include: { assignee: true }, orderBy: { dueDate: 'asc' } } }
        });
        if (!sprint) return { project, activeSprint: null };
        const completed = sprint.tasks.filter((task) => task.status === 'DONE').length;
        const wip = sprint.tasks.filter((task) => ['IN_PROGRESS', 'REVIEW'].includes(task.status)).length;
        return {
          project,
          activeSprint: {
            id: sprint.id,
            name: sprint.name,
            goal: sprint.goal,
            startDate: sprint.startDate.toISOString(),
            endDate: sprint.endDate.toISOString(),
            wip: { current: wip, limit: sprint.wipLimit },
            taskCount: sprint.tasks.length,
            completedTaskCount: completed,
            unfinishedTasks: sprint.tasks.filter((task) => task.status !== 'DONE').map((task) => ({
              title: task.title,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate.toISOString(),
              assignee: task.assignee.name
            }))
          }
        };
      })
    }),

    getTeamWorkload: tool({
      description: '查询项目成员当前未完成、进行中、待审核和逾期任务数量。',
      inputSchema: z.object({ projectKey: z.string().min(2).max(8) }),
      execute: async (input) => record('getTeamWorkload', input, async () => {
        const project = await prisma.project.findFirst({
          where: { key: input.projectKey.toUpperCase(), ...visibleProjectWhere(actor) },
          include: { members: { include: { user: true } }, tasks: true }
        });
        if (!project) return { error: '项目不存在或当前用户无权访问' };
        const now = new Date();
        return {
          project: { id: project.id, key: project.key, name: project.name },
          members: project.members.map((member) => {
            const tasks = project.tasks.filter((task) => task.assigneeId === member.userId && task.status !== 'DONE');
            return {
              id: member.userId,
              name: member.user.name,
              role: member.role,
              unfinishedTasks: tasks.length,
              inProgressTasks: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
              reviewTasks: tasks.filter((task) => task.status === 'REVIEW').length,
              overdueTasks: tasks.filter((task) => task.dueDate < now).length
            };
          })
        };
      })
    }),
    proposeSprintPlan: tool({
      description: '为项目负责人生成可执行的 Sprint 方案并创建待审批卡片。用户要求规划或创建 Sprint 时使用；工具本身不会写入 Sprint。',
      inputSchema: z.object({
        projectKey: z.string().min(2).max(8),
        name: z.string().min(2).max(80).optional(),
        goal: z.string().min(5).max(500).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        wipLimit: z.number().int().min(1).max(30).optional(),
        maxTasks: z.number().int().min(1).max(10).optional()
      }),
      execute: async (input) => record('proposeSprintPlan', input, async () => {
        const proposal = await prepareSprintProposal(runId, actor, input);
        markApproval();
        return proposal;
      })
    })
  };
}