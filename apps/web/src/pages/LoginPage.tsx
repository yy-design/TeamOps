import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Form, Input, Space, Typography } from 'antd';
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
    <main className="login-page login-page--signin">
      <div className="login-panel login-panel--signin">
        <section className="login-visual login-visual--signin" aria-label="TeamOps 智能协作平台">
          <div className="login-visual-art" aria-hidden="true">
            <span className="login-art-grid" />
            <span className="login-orbit login-orbit--outer" />
            <span className="login-orbit login-orbit--inner" />
            <span className="login-art-wing login-art-wing--left" />
            <span className="login-art-wing login-art-wing--right" />
            <span className="login-art-core"><SafetyCertificateOutlined /></span>
          </div>
          <div className="login-visual-copy">
            <Typography.Text className="eyebrow">TeamOps</Typography.Text>
            <Typography.Title level={2}>智能协作中心</Typography.Title>
            <Typography.Text>项目 · 任务 · 权限 · 交付</Typography.Text>
          </div>
        </section>

        <section className="login-form-panel login-form-panel--signin">
          <div className="login-heading">
            <span className="login-brand-mark"><SafetyCertificateOutlined /></span>
            <Typography.Title level={3}>欢迎登录 TeamOps</Typography.Title>
            <Typography.Text>使用你的团队账号进入工作台</Typography.Text>
          </div>

          <Form<LoginFormValues>
            className="signin-form"
            layout="vertical"
            initialValues={{ email: 'admin@teamops.dev', password: 'TeamOps123!' }}
            onFinish={(values) => mutation.mutate(values)}
          >
            {registered ? <Alert type="success" message="注册成功，请使用新账号登录。" showIcon /> : null}
            {mutation.isError ? <Alert type="error" message="登录失败，请检查账号、密码或后端服务。" showIcon /> : null}
            <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
              <Input prefix={<MailOutlined />} placeholder="请输入邮箱" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
            </Form.Item>
            <div className="login-options">
              <Checkbox defaultChecked>保持登录状态</Checkbox>
              <Typography.Text>安全访问</Typography.Text>
            </div>
            <Button type="primary" htmlType="submit" block loading={mutation.isPending}>
              进入工作台
            </Button>
          </Form>

          <Space direction="vertical" size={2} className="demo-accounts">
            <Typography.Text className="demo-accounts__title">演示账号</Typography.Text>
            <Typography.Text>管理员：admin@teamops.dev</Typography.Text>
            <Typography.Text>经理：manager@teamops.dev · 成员：member@teamops.dev</Typography.Text>
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
