import type { UserRole } from '@teamops/shared';

const roleRank: Record<UserRole, number> = {
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3
};

export function canAccess(required: UserRole, actual: UserRole) {
  return roleRank[actual] >= roleRank[required];
}

export function canManageUsers(role: UserRole) {
  return role === 'ADMIN';
}

export function canManageProjects(_role: UserRole) {
  return true;
}

export function hasGlobalDataAccess(role: UserRole) {
  return role === 'ADMIN';
}

export function canAccessOwnedResource(role: UserRole, userId: string, ownerId: string) {
  return hasGlobalDataAccess(role) || userId === ownerId;
}
