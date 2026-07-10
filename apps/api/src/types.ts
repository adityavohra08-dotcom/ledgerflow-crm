import type { Request } from 'express';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  role: string;
  clientId?: string;
}

export interface RequestContext {
  tenantId: string;
  clientId: string;
  userId?: string;
  role?: string;
}

export type AuthedRequest = Request & { auth?: AuthPayload; ctx: RequestContext };