import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@teamops/shared';
import { prisma } from '../lib/prisma.js';
import { canAccess } from '../lib/permissions.js';

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, process.env.JWT_SECRET ?? 'teamops-local-secret-change-me', { expiresIn: '8h' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: 'Missing authorization token' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'teamops-local-secret-change-me') as AuthUser;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });

    if (!user || !user.active) {
      res.status(401).json({ message: 'User is inactive or no longer exists' });
      return;
    }

    req.user = { id: user.id, role: user.role as UserRole, email: user.email };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !canAccess(role, req.user.role)) {
      res.status(403).json({ message: 'You do not have permission to perform this action' });
      return;
    }
    next();
  };
}
