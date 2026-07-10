import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Space, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const registered = (location.state as { registered?: boolean } | null)?.registered;
  type LoginFormValues = {
    email: string;
    password: string;
  }
  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => authApi.login(values.email, values.password),
    onSuccess: (data) => {
      setSession(data.token, data.user);
      navigate('/dashboard');
    }
  });

  return (
    <main className="login-page">
      <div className="login-panel">
        <section className="login-visual" aria-label="TeamOps 工作台预览">
          <Typography.Text className="eyebrow">TeamOps</Typography.Text>
          <Typography.Title level={2}>把项目、工单、权限和交付数据放在同一张作战图里。</Typography.Title>
          <div className="preview-window" aria-hidden="true">
            <div className="preview-toolbar">
              <span />
              <span />
              <span />
            </div>
            <div className="preview-metrics">
              <strong>92%</strong>
              <span>交付健康度</span>
            </div>
            <div className="preview-board">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
        <section className="login-form-panel">
          <Typography.Title level={3}>登录演示账号</Typography.Title>
          <Form<LoginFormValues>
            layout="vertical"
            initialValues={{ email: 'admin@teamops.dev', password: 'TeamOps123!' }}
            onFinish={(values) => mutation.mutate(values)}
          >
            {registered ? <Alert type="success" message="注册成功，请使用新账号登录。" showIcon /> : null}
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
          <Typography.Text className="auth-switch">
            没有账号？<Link to="/register">注册账号</Link>
          </Typography.Text>
        </section>
      </div>
    </main>
  );
}
