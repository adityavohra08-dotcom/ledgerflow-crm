import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import type { AuthedRequest, AuthPayload } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function authOptional(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.auth = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
    } catch {
      /* ignore invalid token for optional routes */
    }
  }
  next();
}

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.auth = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}