import { DeleteOutlined, EditOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Avatar, Button, DatePicker, Form, Input, Modal, Popconfirm, Progress, Select, Space, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectDto, ProjectStatus } from '@teamops/shared';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { TableFilterPanel } from '../components/TableFilterPanel';
import { teamOpsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const statuses = ['PLANNING', 'ACTIVE', 'AT_RISK', 'DONE'] as const;
type ProjectFilters = { search?: string; status?: ProjectStatus; ownerId?: string };

function apiMessage(error: unknown, fallback: string) {
  return isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? fallback : fallback;
}

export function ProjectsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ProjectFilters>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const canCreateProject = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const { data = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: teamOpsApi.projects });
  const { data: candidates = [] } = useQuery({
    queryKey: ['project-member-candidates'],
    queryFn: teamOpsApi.projectMemberCandidates,
    enabled: canCreateProject
  });
  const ownerCandidates = candidates.filter((candidate) => candidate.role !== 'MEMBER');
  const filteredData = useMemo(() => data.filter((project) => {
    const keyword = filters.search?.trim().toLowerCase();
    const matchesKeyword = !keyword || [project.name, project.key, project.description].join(' ').toLowerCase().includes(keyword);
    return matchesKeyword && (!filters.status || project.status === filters.status) && (!filters.ownerId || project.owner.id === filters.ownerId);
  }), [data, filters]);

  const saveMutation = useMutation({
    mutationFn: (values: any) => {
      const payload = { ...values, key: values.key?.toUpperCase(), dueDate: values.dueDate.toISOString() };
      return editing ? teamOpsApi.updateProject(editing.id, payload) : teamOpsApi.createProject(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOpen(false);
      setEditing(null);
      message.success('项目已保存');
    },
    onError: (error) => message.error(apiMessage(error, '项目保存失败'))
  });
  const deleteMutation = useMutation({
    mutationFn: teamOpsApi.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      message.success('项目已删除');
    },
    onError: (error) => message.error(apiMessage(error, '项目删除失败，请稍后重试'))
  });

  function openEditor(project?: ProjectDto) {
    setEditing(project ?? null);
    form.resetFields();
    form.setFieldsValue(project ? {
      ...project,
      ownerId: project.owner.id,
      memberIds: project.members.filter((member) => member.role === 'MEMBER').map((member) => member.user.id),
      viewerIds: project.members.filter((member) => member.role === 'VIEWER').map((member) => member.user.id),
      dueDate: dayjs(project.dueDate)
    } : {
      status: 'PLANNING',
      dueDate: dayjs().add(30, 'day'),
      ownerId: user?.id,
      memberIds: [],
      viewerIds: []
    });
    setOpen(true);
  }

  const columns: ColumnsType<ProjectDto> = [
    { title: '项目', dataIndex: 'name', width: 250, render: (_, row) => <div className="table-primary-cell"><strong>{row.name}</strong><span>{row.key} · {row.description}</span></div> },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag value={value} /> },
    { title: '负责人', dataIndex: ['owner', 'name'], width: 150, render: (_, row) => <Space><Avatar size={30} style={{ background: row.owner.avatarColor }}>{row.owner.name[0]}</Avatar><strong className="table-person-name">{row.owner.name}</strong></Space> },
    {
      title: <Space size={4}>进度<Tooltip title="项目进度由已完成任务数 ÷ 全部任务数自动计算，无需手动填写。"><InfoCircleOutlined /></Tooltip></Space>,
      dataIndex: 'progress',
      width: 210,
      render: (_, row) => <div className="project-progress"><Progress percent={row.progress} size="small" strokeColor="#007aff" trailColor="#eef0f4" /><span>{row.completedTaskCount} / {row.taskCount} 个任务已完成 · 自动计算</span></div>
    },
    { title: '成员', dataIndex: 'memberCount', width: 80, align: 'center' },
    { title: '任务数', dataIndex: 'taskCount', width: 90, align: 'center' },
    { title: '截止日期', dataIndex: 'dueDate', width: 130, render: (value) => <span className="table-date">{new Date(value).toLocaleDateString('zh-CN')}</span> },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, row) => row.capabilities.canEdit || row.capabilities.canDelete ? <Space size={4}>
        {row.capabilities.canEdit ? <Button type="text" icon={<EditOutlined />} onClick={() => openEditor(row)}>编辑</Button> : null}
        {row.capabilities.canDelete ? <Popconfirm title="删除项目？" description="项目、任务和成员关系将一并删除。" onConfirm={() => deleteMutation.mutate(row.id)}><Button type="text" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> : null}
      </Space> : <span className="table-date">只读</span>
    }
  ];

  const resetFilters = () => { filterForm.resetFields(); setFilters({}); };

  return (
    <div className="page-stack management-page">
      <PageHeader title="项目管理" subtitle="通过项目成员和资源角色控制协作范围。" action={canCreateProject ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新建项目</Button> : undefined} />
      <TableFilterPanel form={filterForm} onFinish={setFilters} onReset={resetFilters}>
        <Form.Item name="search" label="关键词"><Input allowClear placeholder="项目名称、Key 或描述" /></Form.Item>
        <Form.Item name="status" label="项目状态"><Select allowClear placeholder="全部状态" options={statuses.map((status) => ({ value: status, label: <StatusTag value={status} /> }))} /></Form.Item>
        {isAdmin ? <Form.Item name="ownerId" label="负责人"><Select allowClear showSearch optionFilterProp="label" placeholder="全部负责人" options={ownerCandidates.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item> : null}
      </TableFilterPanel>
      <section className="data-table-card">
        <div className="data-table-card__header"><div><span>PROJECTS</span><h3>项目列表</h3></div><small>共 {filteredData.length} 个项目</small></div>
        <Table rowKey="id" loading={isLoading} columns={columns} dataSource={filteredData} scroll={{ x: 1140 }} pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />
      </section>
      <Modal className="entity-modal" title={editing ? '编辑项目' : '新建项目'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
          <Form.Item name="key" label="项目 Key" rules={[{ required: true, min: 2, max: 8 }]}><Input disabled={Boolean(editing)} /></Form.Item>
          <Form.Item name="description" label="项目描述" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={statuses.map((status) => ({ value: status, label: <StatusTag value={status} /> }))} /></Form.Item>
          <Form.Item name="dueDate" label="截止日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          {isAdmin ? <Form.Item name="ownerId" label="负责人" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={ownerCandidates.map((item) => ({ value: item.id, label: `${item.name} · ${item.role}` }))} /></Form.Item> : <Form.Item name="ownerId" hidden><Input /></Form.Item>}
          <Form.Item name="memberIds" label="项目成员"><Select mode="multiple" showSearch optionFilterProp="label" placeholder="可接收和处理任务" options={candidates.map((item) => ({ value: item.id, label: `${item.name} · ${item.title}` }))} /></Form.Item>
          <Form.Item name="viewerIds" label="观察者"><Select mode="multiple" showSearch optionFilterProp="label" placeholder="仅查看项目和任务" options={candidates.map((item) => ({ value: item.id, label: `${item.name} · ${item.title}` }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
