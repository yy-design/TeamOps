import { DeleteOutlined, EditOutlined, MessageOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Card, Col, DatePicker, Drawer, Form, Input, List, Modal, Popconfirm, Row, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskDto, TaskPriority, TaskStatus } from '@teamops/shared';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { teamOpsApi } from '../services/api';

const statusColumns: TaskStatus[] = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function TasksPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [commentForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', status: 'ALL' as TaskStatus | 'ALL', projectId: 'ALL', assigneeId: 'ALL' });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const queryFilters = useMemo(() => ({ search: filters.search || undefined, status: filters.status, projectId: filters.projectId, assigneeId: filters.assigneeId }), [filters]);
  const { data = [], isLoading } = useQuery({ queryKey: ['tasks', queryFilters], queryFn: () => teamOpsApi.tasks(queryFilters) });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: teamOpsApi.projects });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: teamOpsApi.users });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => teamOpsApi.updateTaskStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      message.success('任务状态已更新');
    }
  });
  const saveMutation = useMutation({
    mutationFn: (values: any) => {
      const payload = { ...values, dueDate: values.dueDate.toISOString() };
      return editing ? teamOpsApi.updateTask(editing.id, payload) : teamOpsApi.createTask(payload);
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOpen(false);
      setEditing(null);
      setSelected(task);
      message.success('任务已保存');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: teamOpsApi.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelected(null);
      message.success('任务已删除');
    }
  });
  const commentMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => teamOpsApi.addTaskComment(id, body),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelected(task);
      commentForm.resetFields();
      message.success('评论已发布');
    }
  });

  function openEditor(task?: TaskDto) {
    setEditing(task ?? null);
    form.resetFields();
    form.setFieldsValue(task ? { ...task, projectId: task.project.id, assigneeId: task.assignee.id, dueDate: dayjs(task.dueDate) } : { status: 'BACKLOG', priority: 'MEDIUM', dueDate: dayjs().add(7, 'day'), projectId: projects[0]?.id, assigneeId: users[0]?.id });
    setOpen(true);
  }

  const columns: ColumnsType<TaskDto> = [
    { title: '任务', dataIndex: 'title', render: (_, row) => <div><Button type="link" className="table-link" onClick={() => setSelected(row)}>{row.title}</Button><br /><Typography.Text type="secondary">{row.project.key} · {row.description}</Typography.Text></div> },
    { title: '状态', dataIndex: 'status', render: (value, row) => <Select value={value} onChange={(status) => statusMutation.mutate({ id: row.id, status })} options={statusColumns.map((status) => ({ value: status, label: status.replaceAll('_', ' ') }))} /> },
    { title: '优先级', dataIndex: 'priority', render: (value) => <StatusTag value={value} /> },
    { title: '负责人', dataIndex: ['assignee', 'name'], render: (_, row) => <Space><Avatar style={{ background: row.assignee.avatarColor }}>{row.assignee.name[0]}</Avatar>{row.assignee.name}</Space> },
    { title: '截止日期', dataIndex: 'dueDate', render: (value) => new Date(value).toLocaleDateString() },
    { title: '操作', render: (_, row) => <Space><Button icon={<EditOutlined />} onClick={() => openEditor(row)}>编辑</Button><Popconfirm title="删除任务？" onConfirm={() => deleteMutation.mutate(row.id)}><Button danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> }
  ];

  return (
    <div className="page-stack">
      <PageHeader title="任务中心" subtitle="列表和看板同时呈现，方便筛选、推进和复盘工单。" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新建任务</Button>} />
      <Card className="toolbar-card">
        <Space wrap>
          <Input.Search placeholder="搜索任务" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} style={{ width: 260 }} />
          <Select value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status }))} style={{ width: 180 }} options={[{ value: 'ALL', label: '全部状态' }, ...statusColumns.map((status) => ({ value: status, label: status.replaceAll('_', ' ') }))]} />
          <Select value={filters.projectId} onChange={(projectId) => setFilters((current) => ({ ...current, projectId }))} style={{ width: 220 }} options={[{ value: 'ALL', label: '全部项目' }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
          <Select value={filters.assigneeId} onChange={(assigneeId) => setFilters((current) => ({ ...current, assigneeId }))} style={{ width: 180 }} options={[{ value: 'ALL', label: '全部负责人' }, ...users.map((item) => ({ value: item.id, label: item.name }))]} />
        </Space>
      </Card>
      <Row gutter={[12, 12]}>
        {statusColumns.map((status) => (
          <Col xs={24} md={12} xl={status === 'BLOCKED' ? 24 : 6} key={status}>
            <Card title={<StatusTag value={status} />} className="board-column">
              {data.filter((task) => task.status === status).map((task) => (
                <button className="task-card" key={task.id} onClick={() => setSelected(task)}>
                  <strong>{task.title}</strong>
                  <span>{task.project.key}</span>
                  <StatusTag value={task.priority} />
                </button>
              ))}
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="任务列表">
        <Table rowKey="id" loading={isLoading} columns={columns} dataSource={data} pagination={{ pageSize: 5 }} />
      </Card>
      <Modal title={editing ? '编辑任务' : '新建任务'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="title" label="任务标题" rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
          <Form.Item name="description" label="任务描述" rules={[{ required: true, min: 8 }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true }]}><Select options={projects.map((project) => ({ value: project.id, label: `${project.key} · ${project.name}` }))} /></Form.Item>
          <Form.Item name="assigneeId" label="负责人" rules={[{ required: true }]}><Select options={users.map((item) => ({ value: item.id, label: `${item.name} · ${item.role}` }))} /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={statusColumns.map((status) => ({ value: status, label: status.replaceAll('_', ' ') }))} /></Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}><Select options={priorities.map((priority) => ({ value: priority, label: priority }))} /></Form.Item>
          <Form.Item name="dueDate" label="截止日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
      <Drawer title={selected?.title} open={Boolean(selected)} onClose={() => setSelected(null)} width={520} extra={selected ? <Space><Button icon={<EditOutlined />} onClick={() => openEditor(selected)}>编辑</Button><Popconfirm title="删除任务？" onConfirm={() => deleteMutation.mutate(selected.id)}><Button danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> : null}>
        {selected ? <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space wrap><StatusTag value={selected.status} /><StatusTag value={selected.priority} /><Typography.Text>{selected.project.name}</Typography.Text></Space>
          <Typography.Paragraph>{selected.description}</Typography.Paragraph>
          <Card size="small" title="负责人"><Space><Avatar style={{ background: selected.assignee.avatarColor }}>{selected.assignee.name[0]}</Avatar>{selected.assignee.name}</Space></Card>
          <Card size="small" title="评论">
            <List dataSource={selected.comments} locale={{ emptyText: '暂无评论' }} renderItem={(comment) => <List.Item><List.Item.Meta avatar={<Avatar style={{ background: comment.author.avatarColor }}>{comment.author.name[0]}</Avatar>} title={comment.author.name} description={<><Typography.Text>{comment.body}</Typography.Text><br /><Typography.Text type="secondary">{new Date(comment.createdAt).toLocaleString()}</Typography.Text></>} /></List.Item>} />
            <Form form={commentForm} layout="vertical" onFinish={(values) => commentMutation.mutate({ id: selected.id, body: values.body })}>
              <Form.Item name="body" rules={[{ required: true, min: 2 }]}><Input.TextArea rows={3} placeholder="写一条评论" /></Form.Item>
              <Button type="primary" icon={<MessageOutlined />} htmlType="submit" loading={commentMutation.isPending}>发布评论</Button>
            </Form>
          </Card>
        </Space> : null}
      </Drawer>
    </div>
  );
}
