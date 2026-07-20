import axios from 'axios';
import type { AuthResponse, DashboardDto, NotificationDto, ProjectDto, ProjectStatus, TaskDto, TaskPriority, TaskStatus, UserDto, UserRole } from '@teamops/shared';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  async login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },
  async me() {
    const { data } = await api.get<UserDto>('/auth/me');
    return data;
  },
  async updateProfile(payload: Partial<Pick<UserDto, 'name' | 'title' | 'avatarColor'>>) {
    const { data } = await api.patch<UserDto>('/auth/me', payload);
    return data;
  }
};

export interface UserPayload {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  title: string;
  avatarColor: string;
  active?: boolean;
}

export interface ProjectPayload {
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  dueDate: string;
  ownerId: string;
}

export interface TaskFilters {
  search?: string;
  status?: TaskStatus | 'ALL';
  projectId?: string;
  assigneeId?: string;
}

export interface TaskPayload {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  projectId: string;
  assigneeId: string;
}

export const teamOpsApi = {
  async dashboard() {
    const { data } = await api.get<DashboardDto>('/dashboard');
    return data;
  },
  async projects() {
    const { data } = await api.get<ProjectDto[]>('/projects');
    return data;
  },
  async createProject(payload: ProjectPayload) {
    const { data } = await api.post<ProjectDto>('/projects', payload);
    return data;
  },
  async updateProject(id: string, payload: Partial<ProjectPayload>) {
    const { data } = await api.patch<ProjectDto>(`/projects/${id}`, payload);
    return data;
  },
  async deleteProject(id: string) {
    await api.delete(`/projects/${id}`);
  },
  async tasks(filters: TaskFilters = {}) {
    const { data } = await api.get<TaskDto[]>('/tasks', { params: filters });
    return data;
  },
  async createTask(payload: TaskPayload) {
    const { data } = await api.post<TaskDto>('/tasks', payload);
    return data;
  },
  async updateTask(id: string, payload: Partial<TaskPayload>) {
    const { data } = await api.patch<TaskDto>(`/tasks/${id}`, payload);
    return data;
  },
  async deleteTask(id: string) {
    await api.delete(`/tasks/${id}`);
  },
  async addTaskComment(id: string, body: string) {
    const { data } = await api.post<TaskDto>(`/tasks/${id}/comments`, { body });
    return data;
  },
  async users() {
    const { data } = await api.get<UserDto[]>('/users');
    return data;
  },
  async createUser(payload: UserPayload & { password: string }) {
    const { data } = await api.post<UserDto>('/users', payload);
    return data;
  },
  async updateUser(id: string, payload: Partial<Omit<UserPayload, 'email' | 'password'>>) {
    const { data } = await api.patch<UserDto>(`/users/${id}`, payload);
    return data;
  },
  async toggleUserActive(id: string) {
    const { data } = await api.patch<UserDto>(`/users/${id}/toggle-active`);
    return data;
  },
  async deleteUser(id: string) {
    await api.delete(`/users/${id}`);
  },
  async notifications() {
    const { data } = await api.get<NotificationDto[]>('/notifications');
    return data;
  },
  async markNotificationRead(id: string) {
    const { data } = await api.patch<NotificationDto>(`/notifications/${id}/read`);
    return data;
  },
  async markAllNotificationsRead() {
    const { data } = await api.patch<NotificationDto[]>('/notifications/read-all');
    return data;
  },
  async updateTaskStatus(id: string, status: TaskDto['status']) {
    const { data } = await api.patch<TaskDto>(`/tasks/${id}/status`, { status });
    return data;
  }
};
