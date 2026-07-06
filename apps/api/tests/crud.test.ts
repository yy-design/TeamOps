import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

async function login(email: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password: 'TeamOps123!' });
  return response.body.token as string;
}

describe('fullstack CRUD APIs', () => {
  const unique = Date.now().toString(36).slice(-5).toUpperCase();
  let adminToken: string;
  let managerToken: string;
  let memberToken: string;
  let memberId: string;
  let managerId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    adminToken = await login('admin@teamops.dev');
    managerToken = await login('manager@teamops.dev');
    memberToken = await login('member@teamops.dev');

    const users = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    memberId = users.body.find((user: { email: string }) => user.email === 'member@teamops.dev').id;
    managerId = users.body.find((user: { email: string }) => user.email === 'manager@teamops.dev').id;

    const projects = await request(app).get('/api/projects').set('Authorization', `Bearer ${adminToken}`);
    projectId = projects.body[0].id;

    const tasks = await request(app).get('/api/tasks').set('Authorization', `Bearer ${adminToken}`);
    taskId = tasks.body[0].id;
  });

  it('lets a user update their own profile', async () => {
    const response = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: '许知远 Updated', title: 'Senior Frontend Engineer', avatarColor: '#7c3aed' });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('许知远 Updated');
    expect(response.body.title).toBe('Senior Frontend Engineer');
  });

  it('lets admins create and update users including roles', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '赵一鸣', email: `qa-${unique.toLowerCase()}@teamops.dev`, password: 'TeamOps123!', role: 'MEMBER', title: 'QA Engineer', avatarColor: '#0891b2' });

    expect(created.status).toBe(201);
    expect(created.body.email).toBe(`qa-${unique.toLowerCase()}@teamops.dev`);

    const updated = await request(app)
      .patch(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MANAGER', title: 'QA Lead', active: false });

    expect(updated.status).toBe(200);
    expect(updated.body.role).toBe('MANAGER');
    expect(updated.body.active).toBe(false);
  });

  it('lets managers update and delete projects', async () => {
    const created = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Mobile Release Room',
        key: `M${unique}`,
        description: 'Coordinate mobile release readiness across design, API, and QA.',
        status: 'PLANNING',
        progress: 12,
        dueDate: '2026-10-01T10:00:00.000Z',
        ownerId: managerId
      });

    expect(created.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'ACTIVE', progress: 35 });

    expect(updated.status).toBe(200);
    expect(updated.body.progress).toBe(35);

    const deleted = await request(app).delete(`/api/projects/${created.body.id}`).set('Authorization', `Bearer ${managerToken}`);
    expect(deleted.status).toBe(204);
  });

  it('lets authenticated users edit tasks and add comments', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Prepare release checklist',
        description: 'Create a cross-functional checklist for release readiness.',
        status: 'BACKLOG',
        priority: 'HIGH',
        dueDate: '2026-07-30T10:00:00.000Z',
        projectId,
        assigneeId: memberId
      });

    expect(created.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'IN_PROGRESS', priority: 'URGENT' });

    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('IN_PROGRESS');

    const commented = await request(app)
      .post(`/api/tasks/${created.body.id}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ body: 'Checklist draft is ready for review.' });

    expect(commented.status).toBe(201);
    expect(commented.body.comments[0].body).toBe('Checklist draft is ready for review.');
  });

  it('lets users mark all notifications as read', async () => {
    const response = await request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.every((item: { read: boolean }) => item.read)).toBe(true);
  });
});
