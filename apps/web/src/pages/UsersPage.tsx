import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDto, UserRole } from '@teamops/shared';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { TableFilterPanel } from '../components/TableFilterPanel';
import { teamOpsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const roles = ['ADMIN', 'MANAGER', 'MEMBER'] as const;
const colors = ['#007aff', '#34c759', '#af52de', '#ff3b30', '#ff9500', '#5ac8fa'];
type UserFilters = { search?: string; role?: UserRole; active?: boolean };

export function UsersPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [filters, setFilters] = useState<UserFilters>({});
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: teamOpsApi.users });
  const filtered = useMemo(() => data.filter((member) => {
    const keyword = filters.search?.trim().toLowerCase();
    const matchesKeyword = !keyword || [member.name, member.email, member.title].join(' ').toLowerCase().includes(keyword);
    return matchesKeyword && (!filters.role || member.role === filters.role) && (filters.active === undefined || member.active === filters.active);
  }), [data, filters]);
  const saveMutation = useMutation({
    mutationFn: (values: any) => editing ? teamOpsApi.updateUser(editing.id, values) : teamOpsApi.createUser(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      setEditing(null);
      message.success('用户信息已保存');
    }
  });
  const toggleMutation = useMutation({
    mutationFn: teamOpsApi.toggleUserActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      message.success('用户状态已更新');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: teamOpsApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      message.success('用户已删除');
    },
    onError: (error) => {
      const detail = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined;
      message.error(detail ?? '用户删除失败，请稍后重试');
    }
  });

  function openEditor(member?: UserDto) {
    setEditing(member ?? null);
    form.resetFields();
    form.setFieldsValue(member ?? { role: 'MEMBER', avatarColor: '#007aff', active: true });
    setOpen(true);
  }

  const columns: ColumnsType<UserDto> = [
    { title: '成员', dataIndex: 'name', width: 300, render: (_, row) => <Space size={12}><Avatar size={38} style={{ background: row.avatarColor, boxShadow: `0 5px 14px ${row.avatarColor}35` }}>{row.name[0]}</Avatar><div className="table-primary-cell"><strong>{row.name}</strong><span>{row.email}</span></div></Space> },
    { title: '角色', dataIndex: 'role', width: 140, render: (value) => <StatusTag value={value} /> },
    { title: '职位', dataIndex: 'title', width: 220 },
    { title: '状态', dataIndex: 'active', width: 140, render: (value, row) => <Switch checked={value} checkedChildren="启用" unCheckedChildren="禁用" loading={toggleMutation.isPending} onChange={() => toggleMutation.mutate(row.id)} /> },
    { title: '操作', width: 190, align: 'right', fixed: 'right', render: (_, row) => <Space size={4}><Button type="text" icon={<EditOutlined />} onClick={() => openEditor(row)}>编辑</Button><Popconfirm title="确认删除该用户？" description={row.id === currentUser?.id ? '当前登录账号不能删除。' : '删除后无法恢复；有关联业务数据时请改为禁用账号。'} okText="删除" cancelText="取消" okButtonProps={{ danger: true }} disabled={row.id === currentUser?.id} onConfirm={() => deleteMutation.mutate(row.id)}><Button type="text" danger disabled={row.id === currentUser?.id} loading={deleteMutation.isPending} icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> }
  ];

  const resetFilters = () => { filterForm.resetFields(); setFilters({}); };

  return (
    <div className="page-stack management-page">
      <PageHeader title="用户管理" subtitle="管理员可查看成员角色、状态和权限边界。" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新增用户</Button>} />
      <TableFilterPanel form={filterForm} onFinish={setFilters} onReset={resetFilters}>
        <Form.Item name="search" label="关键词"><Input allowClear placeholder="姓名、邮箱或职位" /></Form.Item>
        <Form.Item name="role" label="成员角色"><Select allowClear placeholder="全部角色" options={roles.map((role) => ({ value: role, label: <StatusTag value={role} /> }))} /></Form.Item>
        <Form.Item name="active" label="账号状态"><Select allowClear placeholder="全部状态" options={[{ value: true, label: '已启用' }, { value: false, label: '已禁用' }]} /></Form.Item>
      </TableFilterPanel>
      <section className="data-table-card">
        <div className="data-table-card__header"><div><span>TEAM MEMBERS</span><h3>成员列表</h3></div><small>共 {filtered.length} 位成员</small></div>
        <Table rowKey="id" loading={isLoading} columns={columns} dataSource={filtered} scroll={{ x: 920 }} pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />
      </section>
      <Modal className="entity-modal" title={editing ? '编辑用户' : '新增用户'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
          {!editing ? <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item> : null}
          {!editing ? <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item> : null}
          <Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={roles.map((role) => ({ value: role, label: <StatusTag value={role} /> }))} /></Form.Item>
          <Form.Item name="title" label="职位" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
          <Form.Item name="avatarColor" label="头像色" rules={[{ required: true }]}><Select options={colors.map((color) => ({ value: color, label: <Space><span className="color-dot" style={{ background: color }} />{color}</Space> }))} /></Form.Item>
          {editing ? <Form.Item name="active" label="账号状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="禁用" /></Form.Item> : null}
        </Form>
      </Modal>
    </div>
  );
}
