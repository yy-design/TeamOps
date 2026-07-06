import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const mutation = useMutation({
    mutationFn: (values: { email: string; password: string }) => authApi.login(values.email, values.password),
    onSuccess: (data) => {
      setSession(data.token, data.user);
      navigate('/dashboard');
    }
  });

  return (
    <main className="login-page">
      <section className="login-hero">
        <Typography.Text className="eyebrow">TeamOps</Typography.Text>
        <Typography.Title>把项目、工单、权限和交付数据放在同一张作战图里。</Typography.Title>
        <div className="signal-grid">
          <span>RBAC</span>
          <span>REST API</span>
          <span>Ant Design</span>
          <span>Prisma</span>
        </div>
      </section>
      <Card className="login-card" title="登录演示账号">
        <Form
          layout="vertical"
          initialValues={{ email: 'admin@teamops.dev', password: 'TeamOps123!' }}
          onFinish={(values) => mutation.mutate(values)}
        >
          {mutation.isError ? <Alert type="error" message="登录失败，请检查后端服务是否启动。" showIcon /> : null}
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<MailOutlined />} />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={mutation.isPending}>
            进入工作台
          </Button>
        </Form>
        <Space direction="vertical" className="demo-accounts">
          <Typography.Text>管理员：admin@teamops.dev</Typography.Text>
          <Typography.Text>经理：manager@teamops.dev</Typography.Text>
          <Typography.Text>成员：member@teamops.dev</Typography.Text>
          <Typography.Text type="secondary">统一密码：TeamOps123!</Typography.Text>
        </Space>
      </Card>
    </main>
  );
}
