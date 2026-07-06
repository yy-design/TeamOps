import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { AuthResponse, UserRole } from '@teamops/shared';
import { prisma } from '../lib/prisma.js';
import { toUserDto } from '../lib/mappers.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;

  if (!user || !valid || !user.active) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const response: AuthResponse = {
    token: signToken({ id: user.id, role: user.role as UserRole, email: user.email }),
    user: toUserDto(user)
  };
  res.json(response);
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json(toUserDto(user));
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const parsed = z.object({
    name: z.string().min(2).optional(),
    title: z.string().min(2).optional(),
    avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid profile payload' });
    return;
  }

  const user = await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data });
  await prisma.activityLog.create({ data: { actorId: user.id, message: `Updated profile for ${user.name}` } });
  res.json(toUserDto(user));
});
