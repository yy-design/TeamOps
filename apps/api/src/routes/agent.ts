import { Router, type RequestHandler, type Response } from 'express';
import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { publishNotificationEvent } from '../lib/notificationEvents.js';
import { requireAuth } from '../middleware/auth.js';
import { buildAgentTools } from '../agent/tools.js';
import { getAgentModelConfig } from '../agent/modelProvider.js';
import {
  approveSprintProposal,
  createAgentRun,
  finishAgentRun,
  listConversationRuns,
  rejectSprintProposal
} from '../services/agentExecutionService.js';
import { SprintDomainError } from '../services/sprintService.js';

const route = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

function sendDomainError(res: Response, error: unknown) {
  if (!(error instanceof SprintDomainError)) return false;
  res.status(error.status).json({ message: error.message, code: error.code });
  return true;
}

function serializeConversation(conversation: { id: string; title: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString()
  };
}

function serializeMessage(message: { id: string; role: string; content: string; createdAt: Date }) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString()
  };
}

function messageText(message: unknown) {
  if (!message || typeof message !== 'object') return '';
  const candidate = message as { content?: string; parts?: Array<{ type?: string; text?: string }> };
  if (Array.isArray(candidate.parts)) {
    return candidate.parts.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('');
  }
  return candidate.content ?? '';
}

export const agentRouter = Router();

agentRouter.get('/conversations', requireAuth, route(async (req, res) => {
  const conversations = await prisma.agentConversation.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(conversations.map(serializeConversation));
}));

agentRouter.post('/conversations', requireAuth, route(async (req, res) => {
  const title = typeof req.body?.title === 'string' && req.body.title.trim()
    ? req.body.title.trim().slice(0, 80)
    : '新的对话';
  const conversation = await prisma.agentConversation.create({
    data: { title, userId: req.user!.id }
  });
  res.status(201).json(serializeConversation(conversation));
}));

agentRouter.patch('/conversations/:id', requireAuth, route(async (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(1).max(80) }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '标题长度必须为 1 到 80 个字符' });
    return;
  }
  const result = await prisma.agentConversation.updateMany({
    where: { id: String(req.params.id), userId: req.user!.id },
    data: { title: parsed.data.title }
  });
  if (!result.count) {
    res.status(404).json({ message: '对话不存在' });
    return;
  }
  const conversation = await prisma.agentConversation.findUniqueOrThrow({ where: { id: String(req.params.id) } });
  res.json(serializeConversation(conversation));
}));

agentRouter.delete('/conversations/:id', requireAuth, route(async (req, res) => {
  const result = await prisma.agentConversation.deleteMany({
    where: { id: String(req.params.id), userId: req.user!.id }
  });
  if (!result.count) {
    res.status(404).json({ message: '对话不存在' });
    return;
  }
  res.status(204).send();
}));

agentRouter.get('/conversations/:id/messages', requireAuth, route(async (req, res) => {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: String(req.params.id), userId: req.user!.id }
  });
  if (!conversation) {
    res.status(404).json({ message: '对话不存在' });
    return;
  }
  const messages = await prisma.agentMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' }
  });
  res.json(messages.map(serializeMessage));
}));

agentRouter.get('/conversations/:id/runs', requireAuth, route(async (req, res) => {
  try {
    res.json(await listConversationRuns(String(req.params.id), req.user!.id));
  } catch (error) {
    if (!sendDomainError(res, error)) throw error;
  }
}));

agentRouter.post('/approvals/:id/approve', requireAuth, route(async (req, res) => {
  const parsed = z.object({ expectedVersion: z.number().int().min(0) }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '审批版本参数无效' });
    return;
  }
  try {
    const result = await approveSprintProposal(String(req.params.id), req.user!, parsed.data.expectedVersion);
    result.recipientIds.forEach(publishNotificationEvent);
    res.json(result.run);
  } catch (error) {
    if (!sendDomainError(res, error)) throw error;
  }
}));

agentRouter.post('/approvals/:id/reject', requireAuth, route(async (req, res) => {
  const parsed = z.object({
    expectedVersion: z.number().int().min(0),
    reason: z.string().max(300).optional()
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '拒绝参数无效' });
    return;
  }
  try {
    res.json(await rejectSprintProposal(String(req.params.id), req.user!.id, parsed.data.expectedVersion, parsed.data.reason));
  } catch (error) {
    if (!sendDomainError(res, error)) throw error;
  }
}));

agentRouter.post('/chat', requireAuth, route(async (req, res) => {
  let modelConfig: ReturnType<typeof getAgentModelConfig>;
  try {
    modelConfig = getAgentModelConfig();
  } catch (error) {
    res.status(503).json({ message: error instanceof Error ? error.message : 'AI 模型尚未配置' });
    return;
  }

  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : '';
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId: req.user!.id }
  });
  if (!conversation) {
    res.status(404).json({ message: '对话不存在或无权访问' });
    return;
  }

  const latestUserText = messageText([...messages].reverse().find((message) => message?.role === 'user')).trim();
  if (!latestUserText) {
    res.status(400).json({ message: '请输入有效的问题' });
    return;
  }

  await prisma.$transaction([
    prisma.agentMessage.create({ data: { conversationId, role: 'user', content: latestUserText } }),
    prisma.agentConversation.update({
      where: { id: conversationId },
      data: {
        title: conversation.title === '新的对话' ? latestUserText.replace(/\s+/g, ' ').slice(0, 28) : conversation.title,
        updatedAt: new Date()
      }
    })
  ]);

  const run = await createAgentRun(conversationId, req.user!.id, latestUserText, modelConfig.modelName);
  let waitingApproval = false;
  const modelMessages = await convertToModelMessages(messages);
  const result = streamText({
    model: modelConfig.model,
    system: `你是 TeamOps AI Copilot。当前用户角色是 ${req.user!.role}。回答必须使用中文和 Markdown。涉及项目、任务或 Sprint 的事实必须调用工具查询，不能编造。用户要求规划或创建 Sprint 时，先调用查询工具了解项目，再调用 proposeSprintPlan 生成待审批方案；该工具不会直接写数据，必须明确提示用户在审批卡片中确认。不要声称审批前已经创建 Sprint。`,
    messages: modelMessages,
    tools: buildAgentTools(run.id, req.user!, () => { waitingApproval = true; }),
    stopWhen: stepCountIs(8),
    onFinish: async ({ text }) => {
      const content = text.trim();
      if (content) {
        await prisma.$transaction([
          prisma.agentMessage.create({ data: { conversationId, role: 'assistant', content } }),
          prisma.agentConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
        ]);
      }
      await finishAgentRun(run.id, waitingApproval);
    }
  });

  result.pipeUIMessageStreamToResponse(res);
}));