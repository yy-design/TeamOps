export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER';
export type ProjectRole = 'OWNER' | 'MEMBER' | 'VIEWER';
export type TaskStatus = 'BACKLOG' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'AT_RISK' | 'DONE';
export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  avatarColor: string;
  active: boolean;
}

export interface ProjectMemberDto {
  role: ProjectRole;
  joinedAt: string;
  user: UserDto;
}

export interface ProjectCapabilities {
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canCreateTask: boolean;
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
  membershipRole?: ProjectRole;
  members: ProjectMemberDto[];
  capabilities: ProjectCapabilities;
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
}

export interface SprintDto {
  id: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  wipLimit: number;
  project: Pick<ProjectDto, 'id' | 'name' | 'key'>;
  taskCount: number;
  completedTaskCount: number;
  activeTaskCount: number;
  tasks: Array<{ id: string; title: string; status: TaskStatus }>;
  canManage: boolean;
}

export interface TaskCapabilities {
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canComment: boolean;
  allowedTransitions: TaskStatus[];
}

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  project: Pick<ProjectDto, 'id' | 'name' | 'key'>;
  sprint?: Pick<SprintDto, 'id' | 'name' | 'status'>;
  assignee: UserDto;
  reporter: UserDto;
  comments: CommentDto[];
  capabilities: TaskCapabilities;
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

export interface AgentConversationDto {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export type AgentRunStatus = 'RUNNING' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AgentStepStatus = 'RUNNING' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
export type ToolApprovalStatus = 'PENDING' | 'EXECUTING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface SprintProposalDto {
  schemaVersion: 1;
  project: Pick<ProjectDto, 'id' | 'key' | 'name'>;
  sprint: {
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    wipLimit: number;
  };
  candidates: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: Pick<UserDto, 'id' | 'name'>;
    dueDate: string;
    reason: string;
  }>;
  risks: string[];
  generatedAt: string;
}

export interface ToolApprovalDto {
  id: string;
  type: 'SPRINT_PROPOSAL';
  status: ToolApprovalStatus;
  version: number;
  proposal: SprintProposalDto;
  reason?: string;
  createdAt: string;
  resolvedAt?: string;
  resultSprint?: Pick<SprintDto, 'id' | 'name' | 'status'>;
  capabilities: { canApprove: boolean; canReject: boolean };
}

export interface AgentStepDto {
  id: string;
  sequence: number;
  kind: 'TOOL' | 'APPROVAL';
  status: AgentStepStatus;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface AgentRunDto {
  id: string;
  conversationId?: string;
  status: AgentRunStatus;
  userInput: string;
  model: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  steps: AgentStepDto[];
  approvals: ToolApprovalDto[];
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
