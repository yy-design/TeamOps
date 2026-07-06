import { BellOutlined, DashboardOutlined, LogoutOutlined, ProjectOutlined, SettingOutlined, TeamOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Avatar, Badge, Button, Layout, Menu, Space, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { teamOpsApi } from '../services/api';

const { Header, Content, Sider } = Layout;

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications'], queryFn: teamOpsApi.notifications });
  const unread = notifications.filter((item) => !item.read).length;

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
    { key: '/tasks', icon: <UnorderedListOutlined />, label: '任务中心' },
    ...(user?.role === 'ADMIN' ? [{ key: '/users', icon: <TeamOutlined />, label: '用户管理' }] : []),
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
    { key: '/settings', icon: <SettingOutlined />, label: '系统设置' }
  ];

  return (
    <Layout className="app-shell">
      <Sider breakpoint="lg" collapsedWidth="0" width={248}>
        <div className="brand-block">
          <div className="brand-mark">T</div>
          <div>
            <Typography.Title level={4}>TeamOps</Typography.Title>
            <Typography.Text>Delivery control room</Typography.Text>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="topbar">
          <div>
            <Typography.Text className="topbar-kicker">Enterprise project operations</Typography.Text>
            <Typography.Title level={3} className="topbar-title">项目交付与工单管理</Typography.Title>
          </div>
          <Space size="middle">
            <Badge count={unread} size="small">
              <Button icon={<BellOutlined />} onClick={() => navigate('/notifications')} />
            </Badge>
            <Avatar style={{ background: user?.avatarColor }}>{user?.name.slice(0, 1)}</Avatar>
            <div className="user-meta">
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </div>
            <Button
              icon={<LogoutOutlined />}
              onClick={() => {
                clearSession();
                navigate('/login');
              }}
            />
          </Space>
        </Header>
        <Content className="content-surface">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
