import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Progress, Select, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectDto } from '@teamops/shared';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { teamOpsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const statuses = ['PLANNING', 'ACTIVE', 'AT_RISK', 'DONE'] as const;

export function ProjectsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const user = useAuthStore((state) => state.user);
  const { data = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: teamOpsApi.projects });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: teamOpsApi.users });
  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const saveMutation = useMutation({
    mutationFn: (values: any) => {
      const payload = { ...values, key: values.key?.toUpperCase(), dueDate: values.dueDate.toISOString() };
      return editing ? teamOpsApi.updateProject(editing.id, payload) : teamOpsApi.createProject(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOpen(false);
      setEditing(null);
      message.success('项目已保存');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: teamOpsApi.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      message.success('项目已删除');
    }
  });

  function openEditor(project?: ProjectDto) {
    setEditing(project ?? null);
    form.resetFields();
    form.setFieldsValue(project ? { ...project, ownerId: project.owner.id, dueDate: dayjs(project.dueDate) } : { status: 'PLANNING', progress: 0, dueDate: dayjs().add(30, 'day'), ownerId: user?.id });
    setOpen(true);
  }

  const columns: ColumnsType<ProjectDto> = [
    { title: '项目', dataIndex: 'name', render: (_, row) => <strong>{row.name}<br /><small>{row.key}</small></strong> },
    { title: '状态', dataIndex: 'status', render: (value) => <StatusTag value={value} /> },
    { title: '负责人', dataIndex: ['owner', 'name'], render: (_, row) => <Space><Avatar style={{ background: row.owner.avatarColor }}>{row.owner.name[0]}</Avatar>{row.owner.name}</Space> },
    { title: '进度', dataIndex: 'progress', render: (value) => <Progress percent={value} size="small" /> },
    { title: '任务数', dataIndex: 'taskCount' },
    { title: '截止日期', dataIndex: 'dueDate', render: (value) => new Date(value).toLocaleDateString() },
    { title: '操作', render: (_, row) => canCreate ? <Space><Button icon={<EditOutlined />} onClick={() => openEditor(row)}>编辑</Button><Popconfirm title="删除项目？" description="项目下的任务也会被删除。" onConfirm={() => deleteMutation.mutate(row.id)}><Button danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> : null }
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="项目管理"
        subtitle="用项目视角组织任务、负责人、进度和交付风险。"
        action={canCreate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新建项目</Button> : null}
      />
      <Card>
        <Table rowKey="id" loading={isLoading} columns={columns} dataSource={data} pagination={{ pageSize: 6 }} />
      </Card>
      <Modal title={editing ? '编辑项目' : '新建项目'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
          <Form.Item name="key" label="项目 Key" rules={[{ required: true, min: 2, max: 8 }]}><Input disabled={Boolean(editing)} /></Form.Item>
          <Form.Item name="description" label="项目描述" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={statuses.map((status) => ({ value: status, label: status.replaceAll('_', ' ') }))} /></Form.Item>
          <Form.Item name="progress" label="进度" rules={[{ required: true }]}><InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="dueDate" label="截止日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="ownerId" label="负责人" rules={[{ required: true }]}><Select options={users.map((item) => ({ value: item.id, label: `${item.name} · ${item.role}` }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
