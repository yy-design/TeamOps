import axios from 'axios';
import type { AgentConversationDto, AgentMessageDto, AgentRunDto, AuthResponse, DashboardDto, NotificationDto, ProjectDto, ProjectStatus, RegisterPayload, RegisterResponse, SprintDto, SprintStatus, TaskDto, TaskPriority, TaskStatus, UserDto, UserRole } from '@teamops/shared';
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

export function subscribeToNotificationEvents(onChange: () => void) {
  let disposed = false;
  let controller: AbortController | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  async function connect() {
    const token = useAuthStore.getState().token;
    if (disposed || !token) return;

    controller = new AbortController();
    try {
      const response = await fetch(`${String(api.defaults.baseURL ?? '/api')}/notifications/stream`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal
      });
      if (response.status === 401) {
        disposed = true;
        useAuthStore.getState().clearSession();
        return;
      }
      if (!response.ok || !response.body) throw new Error('Notification stream unavailable');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!disposed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        frames.forEach((frame) => {
          if (frame.includes('event: notifications.changed')) onChange();
        });
      }
    } catch (error) {
      if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('Notification stream disconnected; retrying.', error);
      }
    } finally {
      if (!disposed) reconnectTimer = setTimeout(connect, 3_000);
    }
  }

  void connect();
  return () => {
    disposed = true;
    controller?.abort();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}

export const authApi = {
  async login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },
  async register(payload: RegisterPayload) {
    const { data } = await api.post<RegisterResponse>('/auth/register', payload);
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
  dueDate: string;
  ownerId: string;
  memberIds?: string[];
  viewerIds?: string[];
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
  sprintId?: string | null;
  assigneeId: string;
}

export interface SprintPayload {
  name: string;
  goal: string;
  projectId: string;
  startDate: string;
  endDate: string;
  wipLimit: number;
}

export const agentApi = {
  async conversations() {
    const { data } = await api.get<AgentConversationDto[]>('/agent/conversations');
    return data;
  },
  async createConversation() {
    const { data } = await api.post<AgentConversationDto>('/agent/conversations');
    return data;
  },
  async renameConversation(id: string, title: string) {
    const { data } = await api.patch<AgentConversationDto>(`/agent/conversations/${id}`, { title });
    return data;
  },
  async deleteConversation(id: string) {
    await api.delete(`/agent/conversations/${id}`);
  },
  async messages(id: string) {
    const { data } = await api.get<AgentMessageDto[]>(`/agent/conversations/${id}/messages`);
    return data;
  },
  async runs(conversationId: string) {
    const { data } = await api.get<AgentRunDto[]>(`/agent/conversations/${conversationId}/runs`);
    return data;
  },
  async approve(approvalId: string, expectedVersion: number) {
    const { data } = await api.post<AgentRunDto>(`/agent/approvals/${approvalId}/approve`, { expectedVersion });
    return data;
  },
  async reject(approvalId: string, expectedVersion: number, reason?: string) {
    const { data } = await api.post<AgentRunDto>(`/agent/approvals/${approvalId}/reject`, { expectedVersion, reason });
    return data;
  }
};

export const teamOpsApi = {
  async dashboard() {
    const { data } = await api.get<DashboardDto>('/dashboard');
    return data;
  },
  async projects() {
    const { data } = await api.get<ProjectDto[]>('/projects');
    return data;
  },
  async projectMemberCandidates() {
    const { data } = await api.get<UserDto[]>('/projects/member-candidates');
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
  async sprints() {
    const { data } = await api.get<SprintDto[]>('/sprints');
    return data;
  },
  async createSprint(payload: SprintPayload) {
    const { data } = await api.post<SprintDto>('/sprints', payload);
    return data;
  },
  async updateSprint(id: string, payload: Partial<Omit<SprintPayload, 'projectId'>>) {
    const { data } = await api.patch<SprintDto>(`/sprints/${id}`, payload);
    return data;
  },
  async updateSprintStatus(
    id: string,
    status: Exclude<SprintStatus, 'PLANNING'>,
    options?: { moveIncompleteToBacklog?: boolean }
  ) {
    const payload = {
      status,
      ...(options?.moveIncompleteToBacklog ? { incompleteTaskAction: 'MOVE_TO_BACKLOG' as const } : {})
    };
    const { data } = await api.patch<SprintDto>(`/sprints/${id}/status`, payload);
    return data;
  },
  async deleteSprint(id: string) {
    await api.delete(`/sprints/${id}`);
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
