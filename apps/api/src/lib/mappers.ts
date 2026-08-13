import type { Comment, Project, ProjectMember, Sprint, Task, User } from '@prisma/client';
import type {
  CommentDto,
  ProjectDto,
  ProjectRole,
  ProjectStatus,
  SprintDto,
  SprintStatus,
  TaskDto,
  TaskPriority,
  TaskStatus,
  UserDto,
  UserRole
} from '@teamops/shared';
import { allowedTaskTransitions, canManageProjectResource, type PermissionActor } from './permissions.js';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    title: user.title,
    avatarColor: user.avatarColor,
    active: user.active
  };
}

type ProjectWithMembers = Project & {
  owner: User;
  tasks?: Task[];
  members: Array<ProjectMember & { user: User }>;
};

export function toProjectDto(project: ProjectWithMembers, actor: PermissionActor): ProjectDto {
  const canManage = canManageProjectResource(actor, project.ownerId);
  const membership = project.members.find((member) => member.userId === actor.id);

  return {
    id: project.id,
    name: project.name,
    key: project.key,
    description: project.description,
    status: project.status as ProjectStatus,
    progress: project.tasks?.length
      ? Math.round((project.tasks.filter((task) => task.status === 'DONE').length / project.tasks.length) * 100)
      : 0,
    dueDate: project.dueDate.toISOString(),
    owner: toUserDto(project.owner),
    membershipRole: membership?.role as ProjectRole | undefined,
    members: project.members.map((member) => ({
      role: member.role as ProjectRole,
      joinedAt: member.joinedAt.toISOString(),
      user: toUserDto(member.user)
    })),
    capabilities: {
      canEdit: canManage,
      canDelete: canManage,
      canManageMembers: canManage,
      canCreateTask: canManage
    },
    memberCount: project.members.length,
    taskCount: project.tasks?.length ?? 0,
    completedTaskCount: project.tasks?.filter((task) => task.status === 'DONE').length ?? 0
  };
}

export function toSprintDto(
  sprint: Sprint & { project: Project; tasks: Task[] },
  actor: PermissionActor
): SprintDto {
  return {
    id: sprint.id,
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status as SprintStatus,
    startDate: sprint.startDate.toISOString(),
    endDate: sprint.endDate.toISOString(),
    wipLimit: sprint.wipLimit,
    project: { id: sprint.project.id, name: sprint.project.name, key: sprint.project.key },
    taskCount: sprint.tasks.length,
    completedTaskCount: sprint.tasks.filter((task) => task.status === 'DONE').length,
    activeTaskCount: sprint.tasks.filter((task) => ['IN_PROGRESS', 'REVIEW'].includes(task.status)).length,
    tasks: sprint.tasks.map((task) => ({ id: task.id, title: task.title, status: task.status as TaskStatus })),
    canManage: canManageProjectResource(actor, sprint.project.ownerId)
  };
}

export function toCommentDto(comment: Comment & { author: User }): CommentDto {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: toUserDto(comment.author)
  };
}

export function toTaskDto(
  task: Task & {
    project: Project & { members: Array<ProjectMember & { user: User }> };
    sprint: Sprint | null;
    assignee: User;
    reporter: User;
    comments: Array<Comment & { author: User }>;
  },
  actor: PermissionActor
): TaskDto {
  const canManage = canManageProjectResource(actor, task.project.ownerId);
  const isAssignee = task.assigneeId === actor.id;
  const membership = task.project.members.find((member) => member.userId === actor.id);
  const canComment = canManage || (isAssignee && membership?.role !== 'VIEWER');
  const currentStatus = task.status as TaskStatus;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: currentStatus,
    priority: task.priority as TaskPriority,
    dueDate: task.dueDate.toISOString(),
    project: { id: task.project.id, name: task.project.name, key: task.project.key },
    sprint: task.sprint ? { id: task.sprint.id, name: task.sprint.name, status: task.sprint.status as SprintStatus } : undefined,
    assignee: toUserDto(task.assignee),
    reporter: toUserDto(task.reporter),
    comments: task.comments.map(toCommentDto),
    capabilities: {
      canEdit: canManage,
      canDelete: canManage,
      canChangeStatus: canManage || isAssignee,
      canComment,
      allowedTransitions: canManage || isAssignee ? allowedTaskTransitions(currentStatus, canManage) : []
    }
  };
}
