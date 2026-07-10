import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('auth api', () => {
  it('rejects protected dashboard requests without a token', async () => {
    const response = await request(app).get('/api/dashboard');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Missing authorization token');
  });

  it('registers a new member account without returning a token', async () => {
    const unique = Date.now().toString(36);
    const response = await request(app).post('/api/auth/register').send({
      name: '新成员',
      email: `new-member-${unique}@teamops.dev`,
      password: 'TeamOps123!'
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(`new-member-${unique}@teamops.dev`);
    expect(response.body.user.role).toBe('MEMBER');
    expect(response.body.user.active).toBe(true);
    expect(response.body.token).toBeUndefined();
  });

  it('rejects registration when email already exists', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: '重复用户',
      email: 'admin@teamops.dev',
      password: 'TeamOps123!'
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Email already exists');
  });

  it('rejects registration with weak password', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: '弱密码用户',
      email: 'weak-password@teamops.dev',
      password: 'short'
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid registration payload');
  });
});
