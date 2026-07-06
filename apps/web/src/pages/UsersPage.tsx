import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDto } from '@teamops/shared';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { teamOpsApi } from '../services/api';

const roles = ['ADMIN', 'MANAGER', 'MEMBER'] as const;
const colors = ['#2563eb', '#0f766e', '#7c3aed', '#dc2626', '#ea580c', '#0891b2'];

export function UsersPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [search, setSearch] = useState('');
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: teamOpsApi.users });
  const filtered = useMemo(() => data.filter((user) => [user.name, user.email, user.title, user.role].join(' ').toLowerCase().includes(search.toLowerCase())), [data, search]);
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

  function openEditor(user?: UserDto) {
    setEditing(user ?? null);
    form.resetFields();
    form.setFieldsValue(user ?? { role: 'MEMBER', avatarColor: '#2563eb', active: true });
    setOpen(true);
  }

  const columns: ColumnsType<UserDto> = [
    { title: '成员', dataIndex: 'name', render: (_, row) => <Space><Avatar style={{ background: row.avatarColor }}>{row.name[0]}</Avatar><div><strong>{row.name}</strong><br /><Typography.Text type="secondary">{row.email}</Typography.Text></div></Space> },
    { title: '角色', dataIndex: 'role', render: (value) => <StatusTag value={value} /> },
    { title: '职位', dataIndex: 'title' },
    { title: '状态', dataIndex: 'active', render: (value, row) => <Switch checked={value} checkedChildren="启用" unCheckedChildren="禁用" onChange={() => toggleMutation.mutate(row.id)} /> },
    { title: '操作', render: (_, row) => <Button icon={<EditOutlined />} onClick={() => openEditor(row)}>编辑</Button> }
  ];

  return (
    <div className="page-stack">
      <PageHeader title="用户管理" subtitle="管理员可查看成员角色、状态和权限边界。" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新增用户</Button>} />
      <Card className="toolbar-card">
        <Input.Search placeholder="搜索姓名、邮箱、职位或角色" allowClear value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 360 }} />
      </Card>
      <Card>
        <Table rowKey="id" loading={isLoading} columns={columns} dataSource={filtered} pagination={{ pageSize: 8 }} />
      </Card>
      <Modal title={editing ? '编辑用户' : '新增用户'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
          {!editing ? <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item> : null}
          {!editing ? <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item> : null}
          <Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={roles.map((role) => ({ value: role, label: role }))} /></Form.Item>
          <Form.Item name="title" label="职位" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
          <Form.Item name="avatarColor" label="头像色" rules={[{ required: true }]}><Select options={colors.map((color) => ({ value: color, label: color }))} /></Form.Item>
          {editing ? <Form.Item name="active" label="账号状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="禁用" /></Form.Item> : null}
        </Form>
      </Modal>
    </div>
  );
}
