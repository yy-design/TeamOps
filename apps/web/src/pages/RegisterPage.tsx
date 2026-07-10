import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

type RegisterFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export function RegisterPage() {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (values: RegisterFormValues) => authApi.register({ name: values.name, email: values.email, password: values.password }),
    onSuccess: () => {
      navigate('/login', { state: { registered: true }, replace: true });
    }
  });

  return (
    <main className="login-page">
      <div className="login-panel">
        <section className="login-visual" aria-label="TeamOps 注册预览">
          <Typography.Text className="eyebrow">TeamOps</Typography.Text>
          <Typography.Title level={2}>创建账号后，从项目、任务和消息通知开始协作。</Typography.Title>
          <div className="preview-window" aria-hidden="true">
            <div className="preview-toolbar">
              <span />
              <span />
              <span />
            </div>
            <div className="preview-metrics">
              <strong>24</strong>
              <span>待协作任务</span>
            </div>
            <div className="preview-board">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
        <section className="login-form-panel">
          <Typography.Title level={3}>创建 TeamOps 账号</Typography.Title>
          <Form<RegisterFormValues>
            layout="vertical"
            onFinish={(values) => mutation.mutate(values)}
          >
            {mutation.isError ? <Alert type="error" message="注册失败，请检查邮箱是否已被使用。" showIcon /> : null}
            <Form.Item name="name" label="姓名" rules={[{ required: true, min: 2 }]}>
              <Input prefix={<UserOutlined />} />
            </Form.Item>
            <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
              <Input prefix={<MailOutlined />} />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}>
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  }
                })
              ]}
            >
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={mutation.isPending}>
              创建账号
            </Button>
          </Form>
          <Typography.Text className="auth-switch">
            已有账号？<Link to="/login">返回登录</Link>
          </Typography.Text>
        </section>
      </div>
    </main>
  );
}
