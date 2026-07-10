import { prisma } from '../../lib/prisma.js';
import type { RequestContext } from '../../types.js';
import { createProjectSchema } from '@ledgerflow/shared/src/schemas.js';

export async function listProjects(ctx: RequestContext) {
  return prisma.project.findMany({
    where: { clientId: ctx.clientId },
    include: { timeEntries: { take: 10, orderBy: { date: 'desc' } } }
  });
}

export async function createProject(ctx: RequestContext, body: unknown) {
  const data = createProjectSchema.parse(body);
  return prisma.project.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      name: data.name,
      code: data.code,
      hourlyRate: data.hourlyRate,
      budgetHours: data.budgetHours
    }
  });
}

export async function logTime(ctx: RequestContext, projectId: string, body: Record<string, unknown>) {
  if (!ctx.userId) throw new Error('userId required for time entry');
  return prisma.timeEntry.create({
    data: {
      tenantId: ctx.tenantId,
      projectId,
      userId: ctx.userId,
      date: new Date(String(body.date || new Date().toISOString().slice(0, 10))),
      hours: Number(body.hours || 0),
      description: body.description ? String(body.description) : undefined,
      billable: (body.billable as 'BILLABLE' | 'NON_BILLABLE') || 'BILLABLE'
    }
  });
}