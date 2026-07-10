import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../types.js';

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || 'udyog-suvidha';

export function resolveContext(req: AuthedRequest, _res: Response, next: NextFunction) {
  const tenantId =
    req.headers['x-tenant-id']?.toString() ||
    req.auth?.tenantId ||
    (req.query.tenantId as string) ||
    DEFAULT_TENANT;

  const clientId =
    req.headers['x-client-id']?.toString() ||
    req.auth?.clientId ||
    (req.query.clientId as string) ||
    (req.body?.clientId as string) ||
    '';

  req.ctx = {
    tenantId: String(tenantId),
    clientId: String(clientId),
    userId: req.auth?.userId,
    role: req.auth?.role
  };
  next();
}

export function requireClient(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.ctx?.clientId) {
    return res.status(400).json({ error: 'x-client-id header or clientId query required' });
  }
  next();
}