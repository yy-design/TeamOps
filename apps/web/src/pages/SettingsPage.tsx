import { App, Button, Card, Col, Form, Input, Radio, Row, Segmented, Space, Switch } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { ThemeMode, usePreferencesStore } from '../store/preferencesStore';

const colors = ['#2563eb', '#0f766e', '#7c3aed', '#dc2626', '#ea580c'];

export function SettingsPage() {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const token = useAuthStore((state) => state.token);
  const preferences = usePreferencesStore();
  const mutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (updated) => {
      if (token) setSession(token, updated);
      message.success('个人资料已保存');
    }
  });

  return (
    <div className="page-stack">
      <PageHeader title="系统设置" subtitle="展示主题、个人资料和团队工作偏好的配置入口。" />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="个人资料">
            <Form layout="vertical" initialValues={user ?? undefined} onFinish={(values) => mutation.mutate(values)}>
              <Form.Item label="姓名" name="name" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
              <Form.Item label="邮箱" name="email"><Input disabled /></Form.Item>
              <Form.Item label="职位" name="title" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
              <Form.Item label="头像色" name="avatarColor" rules={[{ required: true }]}>
                <Radio.Group>
                  <Space wrap>
                    {colors.map((color) => (
                      <Radio.Button value={color} key={color}>
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
        <Col xs={24} xl={12}>
          <Card title="界面偏好">
            <Form layout="vertical">
              <Form.Item label="主题模式">
                <Segmented
                  options={[{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }, { label: '跟随系统', value: 'system' }]}
                  value={preferences.mode}
                  onChange={(mode) => preferences.setPreferences({ mode: mode as ThemeMode })}
                />
              </Form.Item>
              <Form.Item label="主色">
                <Radio.Group value={preferences.primaryColor} onChange={(event) => preferences.setPreferences({ primaryColor: event.target.value })}>
                  <Space wrap>
                    {colors.map((color) => (
                      <Radio.Button value={color} key={color}>
                        <span className="color-dot" style={{ background: color }} />
                      </Radio.Button>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="紧凑表格"><Switch checked={preferences.compact} onChange={(compact) => preferences.setPreferences({ compact })} /></Form.Item>
              <Form.Item label="任务到期提醒"><Switch checked={preferences.dueReminders} onChange={(dueReminders) => preferences.setPreferences({ dueReminders })} /></Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
