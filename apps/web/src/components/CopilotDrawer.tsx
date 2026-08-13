import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined, RobotOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, App, Avatar, Button, Drawer, Empty, Input, Popconfirm, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AgentConversationDto, AgentRunDto, ToolApprovalDto } from '@teamops/shared';
import { agentApi, api } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface CopilotDrawerProps {
  open: boolean;
  onClose: () => void;
}

function textFromMessage(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function historyToUiMessages(messages: Awaited<ReturnType<typeof agentApi.messages>>): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.content }]
  }));
}

function toolLabel(type: string) {
  const name = type.replace(/^tool-/, '');
  return ({
    listProjects: '查询项目',
    listProjectTasks: '查询项目任务',
    inspectActiveSprint: '检查当前迭代',
    getTeamWorkload: '查询团队负载',
    proposeSprintPlan: '生成 Sprint 方案',
    createSprintPlan: '执行 Sprint 方案'
  } as Record<string, string>)[name] ?? name;
}

function ToolPart({ part }: { part: Record<string, unknown> }) {
  const state = String(part.state ?? 'input-available');
  const finished = state === 'output-available';
  const failed = state === 'output-error';
  return (
    <div className="copilot-tool-card">
      <div className="copilot-tool-card__header">
        <Space><RobotOutlined /><strong>{toolLabel(String(part.type ?? 'tool'))}</strong></Space>
        <Tag color={failed ? 'error' : finished ? 'success' : 'processing'}>{failed ? '失败' : finished ? '已完成' : '执行中'}</Tag>
      </div>
      {part.input ? <details><summary>查看工具参数</summary><pre>{JSON.stringify(part.input, null, 2)}</pre></details> : null}
      {failed ? <Typography.Text type="danger">{String(part.errorText ?? '工具执行失败')}</Typography.Text> : null}
    </div>
  );
}

function SprintApprovalCard({ approval, conversationId }: { approval: ToolApprovalDto; conversationId: string }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const decision = useMutation({
    mutationFn: ({ action }: { action: 'approve' | 'reject' }) => action === 'approve'
      ? agentApi.approve(approval.id, approval.version)
      : agentApi.reject(approval.id, approval.version, '用户拒绝了当前 Sprint 方案'),
    onSuccess: (updatedRun, variables) => {
      queryClient.setQueryData<AgentRunDto[]>(['agent', 'runs', conversationId], (current = []) =>
        current.map((run) => run.id === updatedRun.id ? updatedRun : run)
      );
      ['sprints', 'tasks', 'projects', 'dashboard', 'notifications'].forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      message.success(variables.action === 'approve' ? 'Sprint 已创建并关联候选任务' : '已拒绝 Sprint 方案');
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', 'runs', conversationId] });
      message.error('审批处理失败，方案可能已变化，请刷新后重试');
    }
  });
  const proposal = approval.proposal;
  const pending = approval.status === 'PENDING';

  return (
    <div className="copilot-approval-card">
      <div className="copilot-approval-card__header">
        <div><span>SPRINT PROPOSAL</span><strong>{proposal.sprint.name}</strong></div>
        <Tag color={pending ? 'gold' : approval.status === 'APPROVED' ? 'success' : 'default'}>{pending ? '等待审批' : approval.status === 'APPROVED' ? '已执行' : '已拒绝'}</Tag>
      </div>
      <p>{proposal.sprint.goal}</p>
      <div className="copilot-approval-card__metrics">
        <span><small>项目</small><strong>{proposal.project.key}</strong></span>
        <span><small>任务</small><strong>{proposal.candidates.length}</strong></span>
        <span><small>WIP</small><strong>{proposal.sprint.wipLimit}</strong></span>
      </div>
      <div className="copilot-approval-card__dates">{new Date(proposal.sprint.startDate).toLocaleDateString('zh-CN')} — {new Date(proposal.sprint.endDate).toLocaleDateString('zh-CN')}</div>
      <div className="copilot-approval-tasks">
        {proposal.candidates.map((task) => <div key={task.id}><span>{task.title}</span><Tag>{task.priority}</Tag></div>)}
      </div>
      {pending ? <Space>
        <Popconfirm title="确认创建这个 Sprint？" description="系统会创建规划中 Sprint，并把候选任务关联进去。" onConfirm={() => decision.mutate({ action: 'approve' })}><Button type="primary" loading={decision.isPending}>确认执行</Button></Popconfirm>
        <Popconfirm title="拒绝当前方案？" onConfirm={() => decision.mutate({ action: 'reject' })}><Button loading={decision.isPending}>拒绝</Button></Popconfirm>
      </Space> : null}
      {approval.resultSprint ? <Typography.Text type="success">已创建：{approval.resultSprint.name}</Typography.Text> : null}
    </div>
  );
}

function AgentRunTimeline({ runs, conversationId }: { runs: AgentRunDto[]; conversationId: string }) {
  if (!runs.length) return null;
  return <div className="copilot-runs">
    {runs.map((run) => <section className="copilot-run" key={run.id}>
      <div className="copilot-run__header"><strong>Agent 执行轨迹</strong><Tag color={run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'error' : run.status === 'WAITING_APPROVAL' ? 'gold' : 'processing'}>{run.status}</Tag></div>
      {run.steps.map((step) => <div className="copilot-run__step" key={step.id}>
        <span className={`copilot-run__dot copilot-run__dot--${step.status.toLowerCase()}`} />
        <div><strong>{step.kind === 'APPROVAL' ? '执行已审批方案' : toolLabel(`tool-${step.toolName ?? 'tool'}`)}</strong><small>{step.status}{step.finishedAt ? ` · ${Math.max(0, new Date(step.finishedAt).getTime() - new Date(step.startedAt).getTime())}ms` : ''}</small></div>
      </div>)}
      {run.approvals.map((approval) => <SprintApprovalCard key={approval.id} approval={approval} conversationId={conversationId} />)}
    </section>)}
  </div>;
}

function CopilotChat({ conversationId, onFinish }: { conversationId: string; onFinish: () => void }) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstPaint = useRef(true);
  const transport = useMemo(() => new DefaultChatTransport({
    api: `${String(api.defaults.baseURL ?? '/api')}/agent/chat`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: { conversationId }
  }), [conversationId, token]);
  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    id: conversationId,
    transport,
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', 'runs', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', 'messages', conversationId] });
      onFinish();
    }
  });
  const history = useQuery({
    queryKey: ['agent', 'messages', conversationId],
    queryFn: () => agentApi.messages(conversationId)
  });
  const runs = useQuery({
    queryKey: ['agent', 'runs', conversationId],
    queryFn: () => agentApi.runs(conversationId)
  });
  const isStreaming = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (!history.data) return;
    firstPaint.current = true;
    setMessages(historyToUiMessages(history.data));
  }, [history.data, setMessages]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (firstPaint.current) {
      viewport.scrollTop = viewport.scrollHeight;
      firstPaint.current = false;
      return;
    }
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
  }, [messages, runs.data]);

  useEffect(() => () => { void stop(); }, [stop]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value || isStreaming) return;
    void sendMessage({ text: value });
    setInput('');
  }

  if (history.isLoading) return <div className="copilot-loading"><Spin /><span>正在恢复对话...</span></div>;

  return (
    <div className="copilot-chat">
      <div className="copilot-messages" ref={viewportRef}>
        {!messages.length ? (
          <div className="copilot-empty">
            <Avatar size={48} icon={<RobotOutlined />} />
            <Typography.Title level={4}>TeamOps AI Copilot</Typography.Title>
            <Typography.Paragraph type="secondary">我可以读取你有权访问的项目、任务和 Sprint，帮助分析进度、延期与交付风险，并在审批后执行 Sprint 规划。</Typography.Paragraph>
            <Space wrap className="copilot-prompts">
              {['列出我可以访问的项目', '分析 PORTAL 项目的延期风险', '检查 PORTAL 当前 Sprint', '为 DSM 项目规划下一次 Sprint'].map((prompt) => (
                <Button key={prompt} size="small" onClick={() => void sendMessage({ text: prompt })}>{prompt}</Button>
              ))}
            </Space>
          </div>
        ) : null}
        {messages.map((chatMessage) => (
          <div className={`copilot-message copilot-message--${chatMessage.role}`} key={chatMessage.id}>
            <span className="copilot-message__author">{chatMessage.role === 'user' ? '你' : 'AI Copilot'}</span>
            <div className="copilot-message__body">
              {chatMessage.parts.map((part, index) => {
                if (part.type === 'text') {
                  const text = textFromMessage({ ...chatMessage, parts: [part] });
                  return chatMessage.role === 'assistant'
                    ? <ReactMarkdown remarkPlugins={[remarkGfm]} key={index}>{text}</ReactMarkdown>
                    : <Typography.Text key={index}>{text}</Typography.Text>;
                }
                if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                  return <ToolPart key={index} part={part as unknown as Record<string, unknown>} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {runs.isError ? <Alert type="warning" showIcon message="执行轨迹加载失败" /> : null}
        <AgentRunTimeline runs={runs.data ?? []} conversationId={conversationId} />
        {isStreaming ? <div className="copilot-streaming"><span />AI 正在分析 TeamOps 数据...</div> : null}
        {error ? <Alert type="error" showIcon message="Copilot 请求失败" description={error.message} /> : null}
      </div>
      <form className="copilot-composer" onSubmit={submit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit(event);
            }
          }}
          rows={3}
          placeholder="询问项目进度、延期风险，或生成待审批的 Sprint 方案..."
          disabled={isStreaming}
        />
        {isStreaming
          ? <Button icon={<StopOutlined />} onClick={() => void stop()}>停止</Button>
          : <Button type="primary" htmlType="submit" icon={<SendOutlined />} disabled={!input.trim()}>发送</Button>}
      </form>
    </div>
  );
}

export function CopilotDrawer({ open, onClose }: CopilotDrawerProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const conversations = useQuery({
    queryKey: ['agent', 'conversations'],
    queryFn: agentApi.conversations,
    enabled: open
  });
  const createConversation = useMutation({
    mutationFn: agentApi.createConversation,
    onSuccess: (conversation) => {
      queryClient.setQueryData<AgentConversationDto[]>(['agent', 'conversations'], (current = []) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id)
      ]);
      setRenaming(false);
      setSelectedId(conversation.id);
      queryClient.invalidateQueries({ queryKey: ['agent', 'conversations'] });
    },
    onError: () => message.error('新对话创建失败，请稍后重试')
  });
  const renameConversation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => agentApi.renameConversation(id, title),
    onSuccess: (updated) => {
      queryClient.setQueryData<AgentConversationDto[]>(['agent', 'conversations'], (current = []) =>
        current.map((item) => item.id === updated.id ? updated : item)
      );
      setRenaming(false);
      message.success('对话标题已更新');
    },
    onError: () => message.error('标题更新失败，请稍后重试')
  });
  const deleteConversation = useMutation({
    mutationFn: agentApi.deleteConversation,
    onSuccess: (_result, deletedId) => {
      const current = queryClient.getQueryData<AgentConversationDto[]>(['agent', 'conversations']) ?? [];
      const remaining = current.filter((item) => item.id !== deletedId);
      queryClient.setQueryData(['agent', 'conversations'], remaining);
      if (selectedId === deletedId) setSelectedId(remaining[0]?.id);
      setRenaming(false);
      queryClient.invalidateQueries({ queryKey: ['agent', 'conversations'] });
    }
  });

  useEffect(() => {
    if (!open || !conversations.data) return;
    if (!conversations.data.length && !selectedId && !createConversation.isPending) {
      createConversation.mutate();
      return;
    }
    if (conversations.data.length && (!selectedId || !conversations.data.some((item) => item.id === selectedId))) {
      setSelectedId(conversations.data[0]?.id);
    }
  }, [open, conversations.data, selectedId, createConversation.isPending]);

  const selectedConversation = conversations.data?.find((item) => item.id === selectedId);

  function handleCreateConversation() {
    setRenaming(false);
    createConversation.mutate();
  }

  function handleSelectConversation(id: string) {
    setRenaming(false);
    setSelectedId(id);
  }

  function beginRename() {
    if (!selectedConversation) return;
    setTitleDraft(selectedConversation.title);
    setRenaming(true);
  }

  function saveTitle() {
    const title = titleDraft.trim();
    if (!selectedId || !title) {
      message.warning('请输入对话标题');
      return;
    }
    renameConversation.mutate({ id: selectedId, title });
  }

  const refreshConversations = () => {
    queryClient.invalidateQueries({ queryKey: ['agent', 'conversations'] });
  };

  return (
    <Drawer
      className="copilot-drawer"
      title={<Space><Avatar size="small" icon={<RobotOutlined />} />TeamOps AI Copilot<Tag color="blue">审批后执行</Tag></Space>}
      open={open}
      onClose={onClose}
      width={600}
      destroyOnClose={false}
      extra={<Button size="small" icon={<PlusOutlined />} onClick={handleCreateConversation} loading={createConversation.isPending}>新对话</Button>}
    >
      <div className="copilot-session-bar">
        {renaming ? (
          <Input
            autoFocus
            maxLength={80}
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onPressEnter={saveTitle}
            placeholder="输入对话标题"
            disabled={renameConversation.isPending}
          />
        ) : (
          <Select
            value={selectedId}
            loading={conversations.isLoading}
            placeholder="选择历史对话"
            onChange={handleSelectConversation}
            options={(conversations.data ?? []).map((item) => ({ value: item.id, label: item.title }))}
          />
        )}
        {renaming ? (
          <>
            <Tooltip title="保存标题"><Button type="primary" icon={<CheckOutlined />} aria-label="保存标题" loading={renameConversation.isPending} onClick={saveTitle} /></Tooltip>
            <Tooltip title="取消重命名"><Button icon={<CloseOutlined />} aria-label="取消重命名" onClick={() => setRenaming(false)} /></Tooltip>
          </>
        ) : (
          <>
            <Tooltip title="重命名当前对话"><Button type="text" icon={<EditOutlined />} aria-label="重命名当前对话" disabled={!selectedId} onClick={beginRename} /></Tooltip>
            {selectedId ? <Popconfirm title="删除当前对话？" onConfirm={() => deleteConversation.mutate(selectedId)}><Tooltip title="删除当前对话"><Button danger type="text" icon={<DeleteOutlined />} aria-label="删除当前对话" loading={deleteConversation.isPending} /></Tooltip></Popconfirm> : null}
          </>
        )}
      </div>
      {conversations.isError ? <Alert type="error" showIcon message="对话加载失败" /> : null}
      {selectedId ? <CopilotChat key={selectedId} conversationId={selectedId} onFinish={refreshConversations} /> : <Empty description="正在创建对话" />}
    </Drawer>
  );
}