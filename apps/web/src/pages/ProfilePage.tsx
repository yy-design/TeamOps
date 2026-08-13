import { useEffect } from 'react';
import { App, Avatar, Button, Card, Col, Form, Input, Radio, Row, Space, Typography } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const avatarColors = ['#2563eb', '#0f766e', '#7c3aed', '#dc2626', '#ea580c'];

interface ProfileFormValues {
  name: string;
  email: string;
  title: string;
  avatarColor: string;
}

export function ProfilePage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileFormValues>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (user) form.setFieldsValue(user);
  }, [form, user]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => authApi.updateProfile({
      name: values.name,
      title: values.title,
      avatarColor: values.avatarColor
    }),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.setQueryData(['auth', 'me'], updated);
      form.setFieldsValue(updated);
      message.success('个人资料已保存');
    },
    onError: () => message.error('个人资料保存失败，请稍后重试')
  });

  return (
    <div className="page-stack profile-page">
      <PageHeader title="个人中心" subtitle="维护个人资料和工作身份信息。" />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="profile-summary-card">
            <Avatar size={88} style={{ background: user?.avatarColor }}>{user?.name.slice(0, 1)}</Avatar>
            <Typography.Title level={3}>{user?.name}</Typography.Title>
            <Typography.Text>{user?.title}</Typography.Text>
            <Typography.Text type="secondary">{user?.email}</Typography.Text>
            <Typography.Text className="profile-role">{user?.role}</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="基本资料">
            <Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)}>
              <Form.Item label="姓名" name="name" rules={[{ required: true, min: 2, message: '姓名至少 2 个字符' }]}><Input /></Form.Item>
              <Form.Item label="邮箱" name="email"><Input disabled /></Form.Item>
              <Form.Item label="职位" name="title" rules={[{ required: true, min: 2, message: '职位至少 2 个字符' }]}><Input /></Form.Item>
              <Form.Item label="头像色" name="avatarColor" rules={[{ required: true }]}>
                <Radio.Group>
                  <Space wrap>
                    {avatarColors.map((color) => (
                      <Radio.Button value={color} key={color} aria-label={`头像色 ${color}`}>
                        <span className="color-dot" style={{ background: color }} />
                      </Radio.Button>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={mutation.isPending}>保存个人资料</Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
