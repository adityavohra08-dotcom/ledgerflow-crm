import { prisma } from '../../lib/prisma.js';
import type { RequestContext } from '../../types.js';
import { seedChartOfAccounts } from '../accounting/accounting.service.js';

export async function listClients(tenantId: string) {
  return prisma.client.findMany({
    where: { tenantId, isActive: true },
    include: { gstins: true, settings: true }
  });
}

export async function getClient(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: { gstins: true, settings: true, fiscalYears: true }
  });
}

export async function createClient(tenantId: string, body: Record<string, unknown>) {
  const client = await prisma.client.create({
    data: {
      tenantId,
      legalName: String(body.legalName || 'New Client'),
      tradeName: body.tradeName ? String(body.tradeName) : undefined,
      stateCode: String(body.stateCode || '07'),
      pan: body.pan ? String(body.pan) : undefined,
      settings: {
        create: {}
      },
      fiscalYears: {
        create: {
          label: '2025-26',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2026-03-31'),
          isCurrent: true
        }
      }
    },
    include: { settings: true, gstins: true }
  });

  if (body.gstin) {
    await prisma.clientGstin.create({
      data: {
        clientId: client.id,
        gstin: String(body.gstin),
        stateCode: String(body.stateCode || '07'),
        isPrimary: true
      }
    });
  }

  await seedChartOfAccounts({ tenantId, clientId: client.id });
  return client;
}