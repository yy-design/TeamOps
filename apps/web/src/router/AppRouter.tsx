import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuthStore } from '../store/authStore';

const DashboardPage = lazy(() => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('../pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const ProjectsPage = lazy(() => import('../pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })));
const SprintsPage = lazy(() => import('../pages/SprintsPage').then((module) => ({ default: module.SprintsPage })));
const TasksPage = lazy(() => import('../pages/TasksPage').then((module) => ({ default: module.TasksPage })));
const UsersPage = lazy(() => import('../pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ProfilePage = lazy(() => import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));

function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function AdminRoute() {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'ADMIN' ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

function RouteFallback() {
  return <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><Spin size="large" tip="页面加载中" /></div>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/sprints" element={<SprintsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
