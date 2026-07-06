import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('auth api', () => {
  it('rejects protected dashboard requests without a token', async () => {
    const response = await request(createApp()).get('/api/dashboard');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Missing authorization token');
  });
});
