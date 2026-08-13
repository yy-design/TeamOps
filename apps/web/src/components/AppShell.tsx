import { BellOutlined, CalendarOutlined, DashboardOutlined, DownOutlined, LogoutOutlined, ProjectOutlined, RobotOutlined, SettingOutlined, TeamOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { App, Avatar, Badge, Button, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { authApi, subscribeToNotificationEvents, teamOpsApi } from '../services/api';

const { Header, Content, Sider } = Layout;
const CopilotDrawer = lazy(() => import('./CopilotDrawer').then((module) => ({ default: module.CopilotDrawer })));

export function AppShell() {
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const { data: currentUser } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications'], queryFn: teamOpsApi.notifications });
  const unread = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (currentUser) setUser(currentUser);
  }, [currentUser, setUser]);

  useEffect(() => {
    if (!user?.id) return undefined;
    return subscribeToNotificationEvents(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });
  }, [queryClient, user?.id]);

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
    { key: '/sprints', icon: <CalendarOutlined />, label: 'Sprint 迭代' },
    { key: '/tasks', icon: <UnorderedListOutlined />, label: '任务中心' },
    ...(user?.role === 'ADMIN' ? [{ key: '/users', icon: <TeamOutlined />, label: '用户管理' }] : []),
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
    { key: '/settings', icon: <SettingOutlined />, label: '系统设置' }
  ];

  const accountMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }
  ];

  const handleAccountMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') {
      navigate('/profile');
      return;
    }
    if (key === 'logout') {
      modal.confirm({
        title: '确认退出登录？',
        content: '退出后需要重新输入账号和密码才能进入 TeamOps。',
        okText: '退出登录',
        cancelText: '取消',
        okButtonProps: { danger: true },
        centered: true,
        onOk: () => {
          clearSession();
          queryClient.clear();
          navigate('/login', { replace: true });
        }
      });
    }
  };

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
            <Button className="copilot-trigger" icon={<RobotOutlined />} onClick={() => setCopilotOpen(true)}>AI Copilot</Button>
            <Badge count={unread} size="small">
              <Button icon={<BellOutlined />} onClick={() => navigate('/notifications')} />
            </Badge>
            <Dropdown menu={{ items: accountMenuItems, onClick: handleAccountMenu }} trigger={['click']} placement="bottomRight">
              <Button type="text" className="topbar-account" aria-label="打开用户菜单">
                <Avatar className="topbar-account__avatar" style={{ background: user?.avatarColor }}>{user?.name.slice(0, 1)}</Avatar>
                <div className="user-meta">
                  <strong>{user?.name}</strong>
                  <span>{user?.role}</span>
                </div>
                <DownOutlined className="topbar-account__chevron" />
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content className="content-surface">
          <Outlet />
        </Content>
        {copilotOpen ? (
          <Suspense fallback={null}>
            <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />
          </Suspense>
        ) : null}
      </Layout>
    </Layout>
  );
}
