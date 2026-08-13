import { Card, Col, Form, Radio, Row, Segmented, Space, Switch } from 'antd';
import { PageHeader } from '../components/PageHeader';
import { ThemeMode, usePreferencesStore } from '../store/preferencesStore';

const colors = ['#2563eb', '#0f766e', '#7c3aed', '#dc2626', '#ea580c'];

export function SettingsPage() {
  const preferences = usePreferencesStore();

  return (
    <div className="page-stack">
      <PageHeader title="系统设置" subtitle="配置主题、主色和工作台显示偏好。个人资料请在右上角个人中心维护。" />
      <Row gutter={[16, 16]}>
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
