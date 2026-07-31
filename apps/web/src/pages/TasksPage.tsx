import { DeleteOutlined, EditOutlined, MessageOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Card, Col, DatePicker, Drawer, Form, Input, List, Modal, Popconfirm, Row, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskDto, TaskPriority, TaskStatus } from '@teamops/shared';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { TableFilterPanel } from '../components/TableFilterPanel';
import { teamOpsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const statusColumns: TaskStatus[] = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
type AppliedTaskFilters = { search?: string; status?: TaskStatus; projectId?: string; assigneeId?: string; priority?: TaskPriority };

export function TasksPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();
  const [commentForm] = Form.useForm();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [filters, setFilters] = useState<AppliedTaskFilters>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const queryFilters = useMemo(() => ({ search: filters.search?.trim() || undefined, status: filters.status, projectId: filters.projectId, assigneeId: filters.assigneeId }), [filters]);
  const { data = [], isLoading } = useQuery({ queryKey: ['tasks', queryFilters], queryFn: () => teamOpsApi.tasks(queryFilters) });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: teamOpsApi.projects });
  const { data: adminUsers = [] } = useQuery({ queryKey: ['users'], queryFn: teamOpsApi.users, enabled: isAdmin });
  const users = isAdmin ? adminUsers : (user ? [user] : []);
  const filteredData = useMemo(() => data.filter((task) => !filters.priority || task.priority === filters.priority), [data, filters.priority]);
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
    form.setFieldsValue(task ? { ...task, projectId: task.project.id, assigneeId: task.assignee.id, dueDate: dayjs(task.dueDate) } : { status: 'BACKLOG', priority: 'MEDIUM', dueDate: dayjs().add(7, 'day'), projectId: projects[0]?.id, assigneeId: isAdmin ? users[0]?.id : user?.id });
    setOpen(true);
  }

  const columns: ColumnsType<TaskDto> = [
    { title: '任务', dataIndex: 'title', width: 340, render: (_, row) => <div className="table-primary-cell"><Button type="link" className="table-link" onClick={() => setSelected(row)}>{row.title}</Button><span>{row.project.key} · {row.description}</span></div> },
    { title: '状态', dataIndex: 'status', width: 150, render: (value, row) => <Select className="table-status-select" value={value} onChange={(status) => statusMutation.mutate({ id: row.id, status })} options={statusColumns.map((status) => ({ value: status, label: <StatusTag value={status} /> }))} /> },
    { title: '优先级', dataIndex: 'priority', width: 110, render: (value) => <StatusTag value={value} /> },
    { title: '负责人', dataIndex: ['assignee', 'name'], width: 150, render: (_, row) => <Space><Avatar size={30} style={{ background: row.assignee.avatarColor }}>{row.assignee.name[0]}</Avatar><strong className="table-person-name">{row.assignee.name}</strong></Space> },
    { title: '截止日期', dataIndex: 'dueDate', width: 130, render: (value) => <span className="table-date">{new Date(value).toLocaleDateString('zh-CN')}</span> },
    { title: '操作', width: 150, fixed: 'right', render: (_, row) => <Space size={4}><Button type="text" icon={<EditOutlined />} onClick={() => openEditor(row)}>编辑</Button><Popconfirm title="删除任务？" onConfirm={() => deleteMutation.mutate(row.id)}><Button type="text" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> }
  ];

  const resetFilters = () => { filterForm.resetFields(); setFilters({}); };

  return (
    <div className="page-stack management-page">
      <PageHeader title="任务中心" subtitle="列表和看板同时呈现，方便筛选、推进和复盘工单。" action={projects.length ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新建任务</Button> : null} />
      <TableFilterPanel form={filterForm} onFinish={setFilters} onReset={resetFilters}>
        <Form.Item name="search" label="关键词"><Input allowClear placeholder="任务标题" /></Form.Item>
        <Form.Item name="status" label="任务状态"><Select allowClear placeholder="全部状态" options={statusColumns.map((status) => ({ value: status, label: <StatusTag value={status} /> }))} /></Form.Item>
        <Form.Item name="projectId" label="所属项目"><Select allowClear showSearch optionFilterProp="label" placeholder="全部项目" options={projects.map((project) => ({ value: project.id, label: project.name }))} /></Form.Item>
        {isAdmin ? <Form.Item name="assigneeId" label="负责人"><Select allowClear showSearch optionFilterProp="label" placeholder="全部负责人" options={users.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item> : null}
        <Form.Item name="priority" label="优先级"><Select allowClear placeholder="全部优先级" options={priorities.map((priority) => ({ value: priority, label: <StatusTag value={priority} /> }))} /></Form.Item>
      </TableFilterPanel>
      <div className="task-board-section">
        <div className="task-board-section__heading">
          <div>
            <span>WORKFLOW</span>
            <h3>任务看板</h3>
          </div>
          <small>按状态纵览工作流</small>
        </div>
        <Row gutter={[12, 12]}>
          {statusColumns.map((status) => (
            <Col xs={24} md={12} xl={status === 'BLOCKED' ? 24 : 6} key={status}>
              <Card
                title={<Space><StatusTag value={status} /><small>{filteredData.filter((task) => task.status === status).length}</small></Space>}
                className={`board-column${status === 'BLOCKED' ? ' board-column--wide' : ''}`}
              >
                {filteredData.filter((task) => task.status === status).map((task) => (
                  <button className="task-card" key={task.id} onClick={() => setSelected(task)}>
                    <strong>{task.title}</strong>
                    <span className="task-card__meta">
                      <span className="task-card__project">{task.project.key}</span>
                      <StatusTag value={task.priority} />
                    </span>
                  </button>
                ))}
              </Card>
            </Col>
          ))}
        </Row>
      </div>
      <section className="data-table-card">
        <div className="data-table-card__header"><div><span>ALL TASKS</span><h3>任务列表</h3></div><small>共 {filteredData.length} 个任务</small></div>
        <Table rowKey="id" loading={isLoading} columns={columns} dataSource={filteredData} scroll={{ x: 1030 }} pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />
      </section>
      <Modal className="entity-modal" title={editing ? '编辑任务' : '新建任务'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="title" label="任务标题" rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
          <Form.Item name="description" label="任务描述" rules={[{ required: true, min: 8 }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true }]}><Select disabled={Boolean(editing) && !isAdmin} options={[...projects, ...(editing && !projects.some((project) => project.id === editing.project.id) ? [editing.project] : [])].map((project) => ({ value: project.id, label: `${project.key} · ${project.name}` }))} /></Form.Item>
          {isAdmin ? <Form.Item name="assigneeId" label="负责人" rules={[{ required: true }]}><Select options={users.map((item) => ({ value: item.id, label: `${item.name} · ${item.role}` }))} /></Form.Item> : <Form.Item name="assigneeId" hidden><Input /></Form.Item>}
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
