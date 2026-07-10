import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export type TenantScoped = { tenantId: string; clientId: string };

/** Application-level scope filter — use with every query until Postgres RLS is enabled */
export function scopeWhere(ctx: TenantScoped) {
  return { tenantId: ctx.tenantId, clientId: ctx.clientId };
}

export * from '@prisma/client';