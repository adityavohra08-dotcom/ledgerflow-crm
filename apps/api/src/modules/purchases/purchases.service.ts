import { prisma } from '../../lib/prisma.js';
import type { RequestContext } from '../../types.js';
import { createBillSchema } from '@ledgerflow/shared/src/schemas.js';

export async function listBills(ctx: RequestContext) {
  return prisma.bill.findMany({ where: { clientId: ctx.clientId }, orderBy: { date: 'desc' }, take: 100 });
}

export async function listPurchaseOrders(ctx: RequestContext) {
  return prisma.purchaseOrder.findMany({ where: { clientId: ctx.clientId }, orderBy: { date: 'desc' }, take: 50 });
}

export async function listExpenses(ctx: RequestContext) {
  return prisma.expense.findMany({ where: { clientId: ctx.clientId }, orderBy: { date: 'desc' }, take: 50 });
}

export async function createBill(ctx: RequestContext, body: unknown) {
  const data = createBillSchema.parse(body);
  return prisma.bill.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      number: data.number,
      date: new Date(data.date),
      supplierGstin: data.supplierGstin,
      taxable: data.taxable,
      cgst: data.cgst,
      sgst: data.sgst,
      igst: data.igst,
      grandTotal: data.grandTotal,
      itcEligible: data.itcEligible,
      status: 'DRAFT'
    }
  });
}