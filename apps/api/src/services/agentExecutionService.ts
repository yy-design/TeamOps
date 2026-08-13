import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AgentRunDto, SprintProposalDto } from '@teamops/shared';
import type { PermissionActor } from '../lib/permissions.js';
import { canManageProjectResource } from '../lib/permissions.js';
import { prisma } from '../lib/prisma.js';
import { createPlanningSprintInTransaction, SprintDomainError } from './sprintService.js';

const priorityRank: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export const sprintProposalSchema = z.object({
  schemaVersion: z.literal(1),
  project: z.object({ id: z.string(), key: z.string(), name: z.string() }),
  sprint: z.object({
    name: z.string().min(2).max(80),
    goal: z.string().min(5).max(500),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    wipLimit: z.number().int().min(1).max(30)
  }),
  candidates: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.literal('BACKLOG'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    assignee: z.object({ id: z.string(), name: z.string() }),
    dueDate: z.string().datetime(),
    reason: z.string()
  })).min(1).max(10),
  risks: z.array(z.string()),
  generatedAt: z.string().datetime()
});

const runInclude = {
  steps: { orderBy: { sequence: 'asc' as const } },
  approvals: { include: { resultSprint: true }, orderBy: { createdAt: 'asc' as const } }
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function serializeAgentRun(run: Awaited<ReturnType<typeof findRunOrThrow>>, actorId: string): AgentRunDto {
  return {
    id: run.id,
    conversationId: run.conversationId ?? undefined,
    status: run.status as AgentRunDto['status'],
    userInput: run.userInput,
    model: run.model,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    error: run.error ?? undefined,
    steps: run.steps.map((step) => ({
      id: step.id,
      sequence: step.sequence,
      kind: step.kind as 'TOOL' | 'APPROVAL',
      status: step.status as AgentRunDto['steps'][number]['status'],
      toolName: step.toolName ?? undefined,
      input: step.input ?? undefined,
      output: step.output ?? undefined,
      error: step.error ?? undefined,
      startedAt: step.startedAt.toISOString(),
      finishedAt: step.finishedAt?.toISOString()
    })),
    approvals: run.approvals.map((approval) => ({
      id: approval.id,
      type: 'SPRINT_PROPOSAL',
      status: approval.status as AgentRunDto['approvals'][number]['status'],
      version: approval.version,
      proposal: approval.proposal as unknown as SprintProposalDto,
      reason: approval.reason ?? undefined,
      createdAt: approval.createdAt.toISOString(),
      resolvedAt: approval.resolvedAt?.toISOString(),
      resultSprint: approval.resultSprint ? {
        id: approval.resultSprint.id,
        name: approval.resultSprint.name,
        status: approval.resultSprint.status as 'PLANNING' | 'ACTIVE' | 'COMPLETED'
      } : undefined,
      capabilities: {
        canApprove: approval.requestedById === actorId && approval.status === 'PENDING',
        canReject: approval.requestedById === actorId && approval.status === 'PENDING'
      }
    }))
  };
}

function findRunOrThrow(id: string) {
  return prisma.agentRun.findUniqueOrThrow({ where: { id }, include: runInclude });
}

export async function listConversationRuns(conversationId: string, actorId: string) {
  const conversation = await prisma.agentConversation.findFirst({ where: { id: conversationId, userId: actorId } });
  if (!conversation) throw new SprintDomainError('对话不存在或无权访问', 404, 'CONVERSATION_NOT_FOUND');
  const runs = await prisma.agentRun.findMany({
    where: { conversationId, requestedById: actorId },
    include: runInclude,
    orderBy: { startedAt: 'asc' },
    take: 50
  });
  return runs.map((run) => serializeAgentRun(run, actorId));
}

export function createAgentRun(conversationId: string, actorId: string, userInput: string, model: string) {
  return prisma.agentRun.create({
    data: { conversationId, requestedById: actorId, userInput, model, status: 'RUNNING' }
  });
}

export async function recordToolStep<T>(
  runId: string,
  sequence: number,
  toolName: string,
  input: unknown,
  execute: () => Promise<T>
) {
  const step = await prisma.agentStep.create({
    data: { runId, sequence, kind: 'TOOL', status: 'RUNNING', toolName, input: asJson(input) }
  });
  try {
    const output = await execute();
    await prisma.agentStep.update({
      where: { id: step.id },
      data: { status: 'COMPLETED', output: asJson(output), finishedAt: new Date() }
    });
    return output;
  } catch (error) {
    await prisma.agentStep.update({
      where: { id: step.id },
      data: { status: 'FAILED', error: error instanceof Error ? error.message : '工具执行失败', finishedAt: new Date() }
    });
    throw error;
  }
}

function defaultSprintDates() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export async function prepareSprintProposal(
  runId: string,
  actor: PermissionActor,
  input: {
    projectKey: string;
    name?: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
    wipLimit?: number;
    maxTasks?: number;
  }
) {
  const project = await prisma.project.findUnique({ where: { key: input.projectKey.toUpperCase() } });
  if (!project) throw new SprintDomainError('项目不存在', 404, 'PROJECT_NOT_FOUND');
  if (!canManageProjectResource(actor, project.ownerId)) {
    throw new SprintDomainError('只有项目负责人或管理员可以生成可执行的 Sprint 方案', 403, 'FORBIDDEN');
  }
  const activeSprint = await prisma.sprint.findFirst({ where: { projectId: project.id, status: 'ACTIVE' } });
  if (activeSprint) {
    throw new SprintDomainError(`项目已有进行中的迭代“${activeSprint.name}”，请先结束后再规划`, 409, 'ACTIVE_SPRINT_EXISTS');
  }

  const tasks = await prisma.task.findMany({
    where: { projectId: project.id, sprintId: null, status: 'BACKLOG' },
    include: { assignee: true },
    orderBy: { dueDate: 'asc' },
    take: 50
  });
  if (!tasks.length) throw new SprintDomainError('当前项目没有可加入 Sprint 的待办任务', 409, 'NO_CANDIDATE_TASKS');

  const now = new Date();
  const selected = tasks
    .sort((a, b) => {
      const overdueA = a.dueDate < now ? 10 : 0;
      const overdueB = b.dueDate < now ? 10 : 0;
      return overdueB + priorityRank[b.priority] - overdueA - priorityRank[a.priority] || a.dueDate.getTime() - b.dueDate.getTime();
    })
    .slice(0, Math.min(Math.max(input.maxTasks ?? 6, 1), 10));
  const defaults = defaultSprintDates();
  const startDate = input.startDate ? new Date(input.startDate) : defaults.start;
  const endDate = input.endDate ? new Date(input.endDate) : defaults.end;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    throw new SprintDomainError('Sprint 方案日期无效', 400, 'INVALID_DATE_RANGE');
  }

  const proposal: SprintProposalDto = {
    schemaVersion: 1,
    project: { id: project.id, key: project.key, name: project.name },
    sprint: {
      name: input.name?.trim() || `${project.key} Sprint ${startDate.toISOString().slice(0, 10)}`,
      goal: input.goal?.trim() || `优先推进 ${project.name} 的高优先级与延期任务`,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      wipLimit: Math.min(Math.max(input.wipLimit ?? 4, 1), 30)
    },
    candidates: selected.map((task) => ({
      id: task.id,
      title: task.title,
      status: 'BACKLOG',
      priority: task.priority as SprintProposalDto['candidates'][number]['priority'],
      assignee: { id: task.assignee.id, name: task.assignee.name },
      dueDate: task.dueDate.toISOString(),
      reason: task.dueDate < now ? '任务已延期，应优先处理' : `${task.priority} 优先级任务`
    })),
    risks: selected.some((task) => task.dueDate < now) ? ['方案包含已延期任务，需要优先确认交付风险'] : [],
    generatedAt: new Date().toISOString()
  };

  const approval = await prisma.toolApproval.create({
    data: {
      type: 'SPRINT_PROPOSAL',
      status: 'PENDING',
      proposal: asJson(proposal),
      preview: asJson({
        project: proposal.project,
        sprint: proposal.sprint,
        taskCount: proposal.candidates.length,
        tasks: proposal.candidates.map(({ id, title, priority, assignee }) => ({ id, title, priority, assignee }))
      }),
      idempotencyKey: randomUUID(),
      runId,
      requestedById: actor.id
    }
  });
  await prisma.agentRun.update({ where: { id: runId }, data: { status: 'WAITING_APPROVAL' } });
  return { approvalRequired: true, approvalId: approval.id, proposal };
}

export async function finishAgentRun(runId: string, waitingApproval: boolean, error?: string) {
  return prisma.agentRun.update({
    where: { id: runId },
    data: error
      ? { status: 'FAILED', error, finishedAt: new Date() }
      : waitingApproval
        ? { status: 'WAITING_APPROVAL' }
        : { status: 'COMPLETED', finishedAt: new Date() }
  });
}

export async function approveSprintProposal(approvalId: string, actor: PermissionActor, expectedVersion: number) {
  const result = await prisma.$transaction(async (tx) => {
    const approval = await tx.toolApproval.findFirst({
      where: { id: approvalId, requestedById: actor.id },
      include: { run: true }
    });
    if (!approval) throw new SprintDomainError('审批不存在或无权处理', 404, 'APPROVAL_NOT_FOUND');
    if (approval.status !== 'PENDING' || approval.version !== expectedVersion) {
      throw new SprintDomainError('审批已被处理，请刷新后查看', 409, 'APPROVAL_ALREADY_RESOLVED');
    }
    const proposal = sprintProposalSchema.parse(approval.proposal);
    const claimed = await tx.toolApproval.updateMany({
      where: { id: approval.id, status: 'PENDING', version: expectedVersion },
      data: { status: 'EXECUTING', version: { increment: 1 }, resolvedById: actor.id }
    });
    if (claimed.count !== 1) throw new SprintDomainError('审批已被其他请求处理', 409, 'APPROVAL_CONFLICT');

    const created = await createPlanningSprintInTransaction(tx, actor, {
      projectId: proposal.project.id,
      ...proposal.sprint,
      startDate: new Date(proposal.sprint.startDate),
      endDate: new Date(proposal.sprint.endDate),
      taskIds: proposal.candidates.map((task) => task.id)
    });
    const lastStep = await tx.agentStep.findFirst({ where: { runId: approval.runId }, orderBy: { sequence: 'desc' } });
    await tx.agentStep.create({
      data: {
        runId: approval.runId,
        sequence: (lastStep?.sequence ?? 0) + 1,
        kind: 'APPROVAL',
        status: 'COMPLETED',
        toolName: 'createSprintPlan',
        input: asJson({ approvalId }),
        output: asJson({ sprintId: created.sprint.id, taskCount: proposal.candidates.length }),
        finishedAt: new Date()
      }
    });
    await tx.toolApproval.update({
      where: { id: approval.id },
      data: { status: 'APPROVED', resolvedAt: new Date(), resultSprintId: created.sprint.id }
    });
    await tx.agentRun.update({
      where: { id: approval.runId },
      data: { status: 'COMPLETED', finishedAt: new Date() }
    });
    return { runId: approval.runId, recipientIds: created.recipientIds };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { run: serializeAgentRun(await findRunOrThrow(result.runId), actor.id), recipientIds: result.recipientIds };
}

export async function rejectSprintProposal(approvalId: string, actorId: string, expectedVersion: number, reason?: string) {
  const approval = await prisma.toolApproval.findFirst({ where: { id: approvalId, requestedById: actorId } });
  if (!approval) throw new SprintDomainError('审批不存在或无权处理', 404, 'APPROVAL_NOT_FOUND');
  const updated = await prisma.toolApproval.updateMany({
    where: { id: approval.id, status: 'PENDING', version: expectedVersion },
    data: {
      status: 'REJECTED',
      version: { increment: 1 },
      resolvedById: actorId,
      resolvedAt: new Date(),
      reason: reason?.trim().slice(0, 300)
    }
  });
  if (updated.count !== 1) throw new SprintDomainError('审批已被处理，请刷新后查看', 409, 'APPROVAL_ALREADY_RESOLVED');
  await prisma.agentRun.update({ where: { id: approval.runId }, data: { status: 'CANCELLED', finishedAt: new Date() } });
  return serializeAgentRun(await findRunOrThrow(approval.runId), actorId);
}