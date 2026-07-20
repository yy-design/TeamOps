import { describe, expect, it } from 'vitest';
import { canAccess, canManageProjects, canManageUsers } from '../src/lib/permissions.js';

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

  it('allows every authenticated role to manage projects in its own data scope', () => {
    expect(canManageProjects('ADMIN')).toBe(true);
    expect(canManageProjects('MANAGER')).toBe(true);
    expect(canManageProjects('MEMBER')).toBe(true);
  });
});
