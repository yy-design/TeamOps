import type { Comment, Project, Task, User } from '@prisma/client';
import type { CommentDto, ProjectDto, ProjectStatus, TaskDto, TaskPriority, TaskStatus, UserDto, UserRole } from '@teamops/shared';

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

export function toProjectDto(project: Project & { owner: User; tasks?: Task[] }): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    key: project.key,
    description: project.description,
    status: project.status as ProjectStatus,
    progress: project.progress,
    dueDate: project.dueDate.toISOString(),
    owner: toUserDto(project.owner),
    memberCount: new Set(project.tasks?.map((task) => task.assigneeId)).size,
    taskCount: project.tasks?.length ?? 0
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
    project: Project;
    assignee: User;
    reporter: User;
    comments: Array<Comment & { author: User }>;
  }
): TaskDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    dueDate: task.dueDate.toISOString(),
    project: { id: task.project.id, name: task.project.name, key: task.project.key },
    assignee: toUserDto(task.assignee),
    reporter: toUserDto(task.reporter),
    comments: task.comments.map(toCommentDto)
  };
}
