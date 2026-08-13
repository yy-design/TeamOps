import { describe, expect, it } from 'vitest';
import {
  allowedTaskTransitions,
  canAccess,
  canManageProjects,
  canManageUsers,
  canTransitionTask
} from '../src/lib/permissions.js';

describe('role permissions', () => {
  it('allows higher-ranked roles to access lower-ranked capabilities', () => {
    expect(canAccess('MEMBER', 'ADMIN')).toBe(true);
    expect(canAccess('MANAGER', 'ADMIN')).toBe(true);
    expect(canAccess('ADMIN', 'MANAGER')).toBe(false);
  });

  it('limits user management to admins', () => {
    expect(canManageUsers('ADMIN')).toBe(true);
    expect(canManageUsers('MANAGER')).toBe(false);
    expect(canManageUsers('MEMBER')).toBe(false);
  });

  it('allows only administrators and managers to create projects', () => {
    expect(canManageProjects('ADMIN')).toBe(true);
    expect(canManageProjects('MANAGER')).toBe(true);
    expect(canManageProjects('MEMBER')).toBe(false);
  });

  it('enforces workflow transitions and owner review', () => {
    expect(allowedTaskTransitions('BACKLOG', false)).toEqual(['IN_PROGRESS', 'BLOCKED']);
    expect(canTransitionTask('IN_PROGRESS', 'REVIEW', false)).toBe(true);
    expect(canTransitionTask('REVIEW', 'DONE', false)).toBe(false);
    expect(canTransitionTask('REVIEW', 'DONE', true)).toBe(true);
    expect(canTransitionTask('BACKLOG', 'DONE', true)).toBe(false);
  });
});
