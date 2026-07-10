import { prisma } from '../../lib/prisma.js';
import type { RequestContext } from '../../types.js';
import { createInvoiceSchema } from '@ledgerflow/shared/src/schemas.js';

export async function listInvoices(ctx: RequestContext) {
  return prisma.invoice.findMany({
    where: { clientId: ctx.clientId },
    orderBy: { date: 'desc' },
    take: 100
  });
}

export async function listQuotes(ctx: RequestContext) {
  return prisma.quote.findMany({ where: { clientId: ctx.clientId }, orderBy: { date: 'desc' }, take: 50 });
}

export async function listSalesOrders(ctx: RequestContext) {
  return prisma.salesOrder.findMany({ where: { clientId: ctx.clientId }, orderBy: { date: 'desc' }, take: 50 });
}

export async function createInvoice(ctx: RequestContext, body: unknown) {
  const data = createInvoiceSchema.parse(body);
  return prisma.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      number: data.number,
      date: new Date(data.date),
      partyName: data.partyName,
      partyGstin: data.partyGstin,
      placeOfSupply: data.placeOfSupply,
      taxable: data.taxable,
      cgst: data.cgst,
      sgst: data.sgst,
      igst: data.igst,
      grandTotal: data.grandTotal,
      status: 'DRAFT',
      lines: data.lines?.length
        ? {
            create: data.lines.map((l, i) => ({
              hsnSac: l.hsnSac,
              description: l.description,
              qty: l.qty,
              rate: l.rate,
              taxable: l.taxable,
              lineOrder: i
            }))
          }
        : undefined
    },
    include: { lines: true }
  });
}

export async function convertQuoteToInvoice(ctx: RequestContext, quoteId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, clientId: ctx.clientId },
    include: { lines: true }
  });
  if (!quote) throw new Error('Quote not found');

  const settings = await prisma.clientSettings.findUnique({ where: { clientId: ctx.clientId } });
  const num = settings?.invoiceNextNumber ?? 1;
  const number = `${settings?.invoicePrefix ?? 'INV'}-${String(num).padStart(5, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      number,
      date: new Date(),
      partyName: 'Converted from quote',
      placeOfSupply: '07',
      taxable: quote.taxable,
      cgst: quote.cgst,
      sgst: quote.sgst,
      igst: quote.igst,
      grandTotal: quote.grandTotal,
      status: 'DRAFT',
      lines: {
        create: quote.lines.map((l, i) => ({
          hsnSac: l.hsnSac,
          description: l.description,
          qty: l.qty,
          rate: l.rate,
          taxable: l.taxable,
          lineOrder: i
        }))
      }
    },
    include: { lines: true }
  });

  await prisma.quote.update({ where: { id: quote.id }, data: { status: 'APPROVED', convertedTo: invoice.id } });
  if (settings) {
    await prisma.clientSettings.update({ where: { clientId: ctx.clientId }, data: { invoiceNextNumber: num + 1 } });
  }
  return invoice;
}