import type { TaskStatus, UserRole } from '@teamops/shared';

const roleRank: Record<UserRole, number> = {
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3
};

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['REVIEW', 'BLOCKED'],
  REVIEW: ['IN_PROGRESS', 'DONE'],
  BLOCKED: ['BACKLOG', 'IN_PROGRESS'],
  DONE: ['IN_PROGRESS']
};

export interface PermissionActor {
  id: string;
  role: UserRole;
}

export function canAccess(required: UserRole, actual: UserRole) {
  return roleRank[actual] >= roleRank[required];
}

export function canManageUsers(role: UserRole) {
  return role === 'ADMIN';
}

export function canManageProjects(role: UserRole) {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function hasGlobalDataAccess(role: UserRole) {
  return role === 'ADMIN';
}

export function canManageProjectResource(actor: PermissionActor, ownerId: string) {
  return hasGlobalDataAccess(actor.role) || (actor.role === 'MANAGER' && actor.id === ownerId);
}

export function allowedTaskTransitions(current: TaskStatus, isProjectReviewer: boolean) {
  return taskTransitions[current].filter((status) => status !== 'DONE' || isProjectReviewer);
}

export function canTransitionTask(current: TaskStatus, next: TaskStatus, isProjectReviewer: boolean) {
  return allowedTaskTransitions(current, isProjectReviewer).includes(next);
}

export function canAccessOwnedResource(role: UserRole, userId: string, ownerId: string) {
  return hasGlobalDataAccess(role) || userId === ownerId;
}
