export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER';
export type TaskStatus = 'BACKLOG' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'AT_RISK' | 'DONE';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  avatarColor: string;
  active: boolean;
}

export interface ProjectDto {
  id: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  dueDate: string;
  owner: UserDto;
  memberCount: number;
  taskCount: number;
}

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  project: Pick<ProjectDto, 'id' | 'name' | 'key'>;
  assignee: UserDto;
  reporter: UserDto;
  comments: CommentDto[];
}

export interface CommentDto {
  id: string;
  body: string;
  createdAt: string;
  author: UserDto;
}

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface DashboardDto {
  summary: {
    totalProjects: number;
    activeTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  taskStatus: Array<{ status: TaskStatus; count: number }>;
  workload: Array<{ user: string; tasks: number; color: string }>;
  recentActivity: Array<{ id: string; message: string; createdAt: string }>;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  user: UserDto;
}

export interface ApiErrorResponse {
  message: string;
}
